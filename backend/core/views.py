from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Customer, Product, Sale, Invoice, Payment
from .serializers import (
    CustomerSerializer, ProductSerializer, SaleSerializer,
    InvoiceSerializer, PaymentSerializer,
)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by("name")
    serializer_class = CustomerSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("category", "name")
    serializer_class = ProductSerializer


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related("customer").prefetch_related("items").order_by("-sale_date")
    serializer_class = SaleSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("customer").order_by("-issue_date")
    serializer_class = InvoiceSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice").order_by("-payment_date")
    serializer_class = PaymentSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def receivables(request):
    """Aggregate outstanding balances per customer."""
    data = []
    for c in Customer.objects.all():
        balance = sum((inv.outstanding_balance for inv in c.invoices.all()), 0)
        if balance > 0:
            data.append({
                "customer_id": c.id,
                "customer_name": c.name,
                "customer_type": c.customer_type,
                "outstanding_balance": balance,
                "credit_limit": c.credit_limit,
            })
    return Response(data)
