from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response


from accounts.permissions import is_manager, module_permission
from farm_erp.date_filter import apply_date_range

from .messaging import send_email, send_sms
from .models import Invoice, InvoiceDispatch, Payment, Sale
from .permissions import CanEditSales
from .serializers import InvoiceSerializer, PaymentSerializer, SaleSerializer


def _void_reason(request) -> str:
    """Validate and return the mandatory void reason."""
    if not is_manager(request.user):
        raise PermissionDenied("Only Admin or Manager can void records.")
    reason = str(request.data.get("reason") or "").strip()
    if len(reason) < 3:
        raise ValidationError({"reason": "A reason is required to void a record."})
    return reason[:500]


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related("customer", "invoice").prefetch_related("items")
    serializer_class = SaleSerializer
    permission_classes = [CanEditSales]
    filterset_fields = ["customer", "payment_type"]
    search_fields = ["invoice__invoice_number", "customer__name"]
    ordering_fields = ["date", "total"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "date")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InvoiceViewSet(mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Invoice.objects.select_related("customer", "voided_by").prefetch_related(
        "sale__items", "adjustments", "credit_uses__target_invoice", "credit_applications",
    )
    serializer_class = InvoiceSerializer
    permission_classes = [module_permission("invoices")]
    filterset_fields = ["customer", "status"]
    search_fields = ["invoice_number", "customer__name"]
    ordering_fields = ["issue_date", "due_date", "total_amount"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "issue_date")

    def update(self, request, *args, **kwargs):
        if self.get_object().is_voided:
            raise ValidationError("A voided invoice cannot be edited.")
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        reason = _void_reason(request)
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=pk)
            if invoice.is_voided:
                raise ValidationError("This invoice is already voided.")
            if invoice.payments.filter(voided_at__isnull=True).exists():
                raise ValidationError(
                    "Void the payments recorded against this invoice first.",
                )
            if invoice.credit_uses.exists():
                raise ValidationError(
                    "Credit from this invoice has been applied elsewhere; "
                    "reverse that first.",
                )
            invoice.voided_at = timezone.now()
            invoice.voided_by = request.user
            invoice.void_reason = reason
            invoice.save(update_fields=["voided_at", "voided_by", "void_reason", "updated_at"])
            # Reverse the stock movement of the underlying sale.
            sale = getattr(invoice, "sale", None)
            if sale:
                from django.db.models import F

                from products.models import Product

                for item in sale.items.all():
                    Product.objects.filter(pk=item.product_id).update(
                        available_quantity=F("available_quantity") + item.quantity,
                    )
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)


    @action(detail=True, methods=["post"], url_path="send")
    def send(self, request, pk=None):
        """Send this invoice to the customer by email and SMS in one action."""
        invoice = self.get_object()
        if invoice.is_voided:
            raise ValidationError("A voided invoice cannot be sent.")

        results = []
        for channel, fn in (("email", send_email), ("sms", send_sms)):
            status_, recipient, detail = fn(invoice)
            InvoiceDispatch.objects.create(
                invoice=invoice, channel=channel, status=status_,
                recipient=recipient, detail=detail, sent_by=request.user,
            )
            results.append({
                "channel": channel, "status": status_,
                "recipient": recipient, "detail": detail,
            })
        return Response({"invoice_number": invoice.invoice_number, "results": results})


class PaymentViewSet(
    mixins.CreateModelMixin, mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet,
):
    """Payments can be created, corrected and voided — never hard-deleted."""

    queryset = Payment.objects.select_related("invoice", "customer", "voided_by")
    serializer_class = PaymentSerializer
    permission_classes = [module_permission("payments")]
    filterset_fields = ["customer", "invoice", "method"]
    ordering_fields = ["date", "amount"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "date")

    def create(self, request, *args, **kwargs):
        # Idempotency: a repeated submit with the same key returns the
        # original payment instead of creating a duplicate record.
        key = (
            request.data.get("idempotency_key")
            or request.headers.get("Idempotency-Key")
            or ""
        ).strip()
        if key:
            existing = Payment.objects.filter(idempotency_key=key).first()
            if existing:
                return Response(
                    self.get_serializer(existing).data, status=status.HTTP_200_OK,
                )
        serializer = self.get_serializer(data={**request.data, "idempotency_key": key or None})
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_create(serializer)
        except IntegrityError:
            existing = Payment.objects.filter(idempotency_key=key).first() if key else None
            if existing:
                return Response(
                    self.get_serializer(existing).data, status=status.HTTP_200_OK,
                )
            raise
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def update(self, request, *args, **kwargs):
        if self.get_object().is_voided:
            raise ValidationError("A voided payment cannot be edited.")
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        reason = _void_reason(request)
        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(pk=pk)
            if payment.is_voided:
                raise ValidationError("This payment is already voided.")
            invoice = Invoice.objects.select_for_update().get(pk=payment.invoice_id)
            payment.voided_at = timezone.now()
            payment.voided_by = request.user
            payment.void_reason = reason
            payment.save(update_fields=["voided_at", "voided_by", "void_reason"])
            # Reverse the money: take the amount back off the invoice.
            invoice.amount_paid = max((invoice.amount_paid or 0) - payment.amount, 0)
            invoice.recompute_status()
            invoice.save(update_fields=["amount_paid", "status", "updated_at"])
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)
