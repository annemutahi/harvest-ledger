from rest_framework import serializers

from customers.models import Customer
from orders.models import Order
from sales.models import Invoice


class SearchCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "company", "phone", "email", "outstanding_balance"]


class SearchOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ["id", "reference", "customer_name", "total", "placed_at", "status"]


class SearchInvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "invoice_number", "customer", "customer_name", "issue_date", "total_amount", "amount_paid", "status"]
