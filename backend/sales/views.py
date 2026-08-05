from django.db import IntegrityError
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response


from accounts.permissions import ReadOnlyForFarmhands
from farm_erp.date_filter import apply_date_range

from .models import Invoice, Payment, Sale
from .permissions import CanEditSales
from .serializers import InvoiceSerializer, PaymentSerializer, SaleSerializer



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
    queryset = Invoice.objects.select_related("customer").prefetch_related(
        "sale__items", "adjustments", "credit_uses", "credit_applications",
    )
    serializer_class = InvoiceSerializer
    permission_classes = [ReadOnlyForFarmhands]
    filterset_fields = ["customer", "status"]
    search_fields = ["invoice_number", "customer__name"]
    ordering_fields = ["issue_date", "due_date", "total_amount"]

    def get_queryset(self):
        return apply_date_range(super().get_queryset(), self.request, "issue_date")


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "customer")
    serializer_class = PaymentSerializer
    permission_classes = [ReadOnlyForFarmhands]
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

