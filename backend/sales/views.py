from rest_framework import viewsets

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


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Invoice.objects.select_related("customer").prefetch_related("sale__items")
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

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)
