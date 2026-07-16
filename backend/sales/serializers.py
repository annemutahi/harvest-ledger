from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from products.models import Product

from .models import Invoice, Payment, Sale, SaleItem


def next_invoice_number() -> str:
    year = timezone.now().year
    last = (
        Invoice.objects.filter(invoice_number__startswith=f"INV-{year}-")
        .order_by("-id").first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.invoice_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = Invoice.objects.count() + 1
    return f"INV-{year}-{seq:04d}"


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "line_total"]
        read_only_fields = ["product_name", "line_total"]


class InvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    outstanding_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    items = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "customer", "customer_name",
            "issue_date", "due_date", "total_amount", "amount_paid",
            "outstanding_balance", "status", "items", "created_at",
        ]
        read_only_fields = fields

    def get_items(self, obj):
        sale = getattr(obj, "sale", None)
        if not sale:
            return []
        return SaleItemSerializer(sale.items.all(), many=True).data


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    status = serializers.CharField(source="invoice.status", read_only=True)
    due_date = serializers.DateField(write_only=True, required=False)
    invoice_date = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = Sale
        fields = [
            "id", "invoice", "invoice_number", "customer", "customer_name",
            "date", "payment_type", "total", "status", "items",
            "due_date", "invoice_date", "created_at",
        ]
        read_only_fields = ["invoice", "total", "created_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        for i in items:
            if i["quantity"] <= 0:
                raise serializers.ValidationError("Quantity must be > 0.")
            if i["unit_price"] < 0:
                raise serializers.ValidationError("Unit price must be >= 0.")
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        due_date = validated_data.pop("due_date", None)
        invoice_date = validated_data.pop("invoice_date", validated_data.get("date"))
        total = sum(Decimal(i["quantity"]) * Decimal(i["unit_price"]) for i in items)

        invoice = Invoice.objects.create(
            invoice_number=next_invoice_number(),
            customer=validated_data["customer"],
            issue_date=invoice_date or timezone.localdate(),
            due_date=due_date or timezone.localdate(),
            total_amount=total,
            amount_paid=(total if validated_data.get("payment_type") == Sale.CASH else 0),
        )
        invoice.recompute_status()
        invoice.save(update_fields=["status", "amount_paid"])

        sale = Sale.objects.create(
            invoice=invoice, total=total, **validated_data,
        )
        for i in items:
            product = i["product"]
            SaleItem.objects.create(
                sale=sale, product=product, product_name=product.name,
                quantity=i["quantity"], unit_price=i["unit_price"],
            )
            # Decrement inventory.
            Product.objects.filter(pk=product.pk).update(
                available_quantity=models_F("available_quantity") - Decimal(i["quantity"]),
            )
        return sale

    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        due_date = validated_data.pop("due_date", None)
        invoice_date = validated_data.pop("invoice_date", None)

        # Restore inventory for old items, then rewrite them.
        if items is not None:
            for old in instance.items.all():
                Product.objects.filter(pk=old.product_id).update(
                    available_quantity=models_F("available_quantity") + old.quantity,
                )
            instance.items.all().delete()
            total = Decimal("0")
            for i in items:
                product = i["product"]
                line_total = Decimal(i["quantity"]) * Decimal(i["unit_price"])
                total += line_total
                SaleItem.objects.create(
                    sale=instance, product=product, product_name=product.name,
                    quantity=i["quantity"], unit_price=i["unit_price"],
                )
                Product.objects.filter(pk=product.pk).update(
                    available_quantity=models_F("available_quantity") - Decimal(i["quantity"]),
                )
            instance.total = total
            instance.invoice.total_amount = total

        for f in ("customer", "date", "payment_type"):
            if f in validated_data:
                setattr(instance, f, validated_data[f])
        if due_date:
            instance.invoice.due_date = due_date
        if invoice_date:
            instance.invoice.issue_date = invoice_date

        instance.invoice.recompute_status()
        instance.invoice.save()
        instance.save()
        return instance


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id", "invoice", "invoice_number", "customer", "customer_name",
            "date", "amount", "method", "notes", "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_amount(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Amount must be > 0.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        payment = super().create(validated_data)
        invoice = payment.invoice
        invoice.amount_paid = (invoice.amount_paid or 0) + payment.amount
        invoice.recompute_status()
        invoice.save(update_fields=["amount_paid", "status", "updated_at"])
        return payment


# Small local helper so we don't shadow django.db.models.F.
from django.db.models import F as models_F  # noqa: E402
