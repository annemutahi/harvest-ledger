from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import uuid

from .models import Customer, Product, Sale, SaleItem, Invoice, Payment


class CustomerSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Customer
        fields = "__all__"


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"


class SaleItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "line_total"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Sale
        fields = ["id", "customer", "customer_name", "payment_type", "total_amount",
                  "sale_date", "notes", "items"]
        read_only_fields = ["total_amount"]

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        sale = Sale.objects.create(**validated_data)
        total = 0
        for item in items_data:
            unit_price = item.get("unit_price") or item["product"].unit_price
            SaleItem.objects.create(sale=sale, product=item["product"],
                                    quantity=item["quantity"], unit_price=unit_price)
            total += item["quantity"] * unit_price
        sale.total_amount = total
        sale.save(update_fields=["total_amount"])

        # Auto-generate invoice
        Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            customer=sale.customer,
            sale=sale,
            due_date=timezone.now().date() + timedelta(days=30),
            total_amount=total,
            amount_paid=total if sale.payment_type == Sale.CASH else 0,
            status=Invoice.PAID if sale.payment_type == Sale.CASH else Invoice.SENT,
        )
        return sale


class InvoiceSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Invoice
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"
