from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from farm_erp.validators import validate_amount, validate_business_date, validate_quantity
from products.models import Product

from .models import CreditApplication, Invoice, InvoiceAdjustment, Payment, Sale, SaleItem


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


class InvoiceAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceAdjustment
        fields = ["id", "kind", "previous_total", "new_total", "amount", "notes", "created_at"]
        read_only_fields = fields


class InvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    outstanding_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True,
    )
    items = serializers.SerializerMethodField()
    sale_id = serializers.SerializerMethodField()
    payment_type = serializers.SerializerMethodField()
    adjustments = InvoiceAdjustmentSerializer(many=True, read_only=True)
    credit_applied = serializers.SerializerMethodField()
    available_credit = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "customer", "customer_name",
            "issue_date", "due_date", "total_amount", "amount_paid",
            "outstanding_balance", "status", "items", "sale_id",
            "payment_type", "adjustments", "credit_applied", "available_credit",
            "etims_number", "created_at",
        ]
        read_only_fields = [f for f in fields if f != "etims_number"]

    def get_sale_id(self, obj):
        sale = getattr(obj, "sale", None)
        return sale.id if sale else None

    def get_payment_type(self, obj):
        sale = getattr(obj, "sale", None)
        return sale.payment_type if sale else None

    def get_credit_applied(self, obj):
        credit = sum((application.amount for application in obj.credit_applications.all()), Decimal("0"))
        return credit if credit > 0 else None

    def get_available_credit(self, obj):
        credit = obj.available_credit
        return credit if credit > 0 else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("credit_applied") in (None, 0, "0", "0.00"):
            data.pop("credit_applied", None)
        if data.get("available_credit") in (None, 0, "0", "0.00"):
            data.pop("available_credit", None)
        return data


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
    adjustment_note = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Sale
        fields = [
            "id", "invoice", "invoice_number", "customer", "customer_name",
            "date", "payment_type", "total", "status", "items",
            "due_date", "invoice_date", "adjustment_note", "created_at",
        ]
        read_only_fields = ["invoice", "total", "created_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        for i in items:
            i["quantity"] = validate_quantity(i["quantity"], field="quantity")
            i["unit_price"] = validate_amount(i["unit_price"], field="unit_price")
        return items

    def validate_date(self, value):
        return validate_business_date(value, field=None)

    def validate_invoice_date(self, value):
        return validate_business_date(value, field=None)

    def validate_due_date(self, value):
        return validate_business_date(value, field=None, allow_future=True, max_future_days=365)

    def validate(self, attrs):
        items = attrs.get("items")
        if items is None:
            return attrs

        requested_quantities: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        restore_quantities: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))

        for item in items:
            product = item.get("product")
            if product is None:
                continue
            requested_quantities[product.id] += Decimal(item["quantity"])

        if self.instance is not None:
            for old in self.instance.items.all():
                restore_quantities[old.product_id] += old.quantity

        for item in items:
            product = item.get("product")
            if product is None:
                continue
            available = (product.available_quantity or Decimal("0")) + restore_quantities.get(product.id, Decimal("0"))
            if available <= 0:
                raise serializers.ValidationError({
                    "items": f"Product {product.name} is out of stock.",
                })
            if requested_quantities[product.id] > available:
                raise serializers.ValidationError({
                    "items": f"Cannot sell more {product.name} than available ({available}).",
                })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        due_date = validated_data.pop("due_date", None)
        invoice_date = validated_data.pop("invoice_date", validated_data.get("date"))
        total = sum(Decimal(i["quantity"]) * Decimal(i["unit_price"]) for i in items)
        customer = validated_data["customer"]
        remaining_credit_to_apply = total
        credit_allocations = []
        applied_credit = Decimal("0")
        credit_sources = Invoice.objects.select_for_update().filter(
            customer=customer, status=Invoice.CREDIT,
        ).prefetch_related("credit_uses")
        for source_invoice in credit_sources:
            if remaining_credit_to_apply <= 0:
                break
            amount = min(source_invoice.available_credit, remaining_credit_to_apply)
            if amount > 0:
                credit_allocations.append((source_invoice, amount))
                applied_credit += amount
                remaining_credit_to_apply -= amount

        invoice = Invoice.objects.create(
            invoice_number=next_invoice_number(),
            customer=customer,
            issue_date=invoice_date or timezone.localdate(),
            due_date=due_date or timezone.localdate(),
            total_amount=total,
            amount_paid=(total if validated_data.get("payment_type") == Sale.CASH else applied_credit),
        )
        invoice.recompute_status()
        invoice.save(update_fields=["status", "amount_paid"])
        for source_invoice, amount in credit_allocations:
            CreditApplication.objects.create(
                source_invoice=source_invoice, target_invoice=invoice, amount=amount,
            )
            # Refresh so the available-credit calculation sees the application
            # just created rather than a prefetched related-object cache.
            source_invoice.refresh_from_db()
            source_invoice.recompute_status()
            source_invoice.save(update_fields=["status", "updated_at"])

        sale = Sale.objects.create(
            invoice=invoice, total=total, **validated_data,
        )
        # If this sale was paid in cash, record a Payment with the sale date
        # so statements and API responses show payment mode and date.
        if sale.payment_type == Sale.CASH:
            Payment.objects.create(
                invoice=invoice,
                customer=customer,
                date=sale.date,
                amount=total,
                method=Payment.CASH,
                recorded_by=getattr(sale, "created_by", None),
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
        adjustment_note = validated_data.pop("adjustment_note", "")
        previous_total = instance.invoice.total_amount

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
        total_change = instance.invoice.total_amount - previous_total
        if total_change:
            InvoiceAdjustment.objects.create(
                invoice=instance.invoice,
                kind=InvoiceAdjustment.DEBIT if total_change > 0 else InvoiceAdjustment.CREDIT,
                previous_total=previous_total,
                new_total=instance.invoice.total_amount,
                amount=abs(total_change),
                notes=adjustment_note.strip(),
                created_by=self.context["request"].user if self.context.get("request") else None,
            )
        instance.save()
        return instance


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    idempotency_key = serializers.CharField(
        max_length=64, required=False, allow_blank=True, allow_null=True, write_only=True,
    )

    class Meta:
        model = Payment
        fields = [
            "id", "invoice", "invoice_number", "customer", "customer_name",
            "date", "amount", "method", "notes", "idempotency_key", "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_amount(self, value):
        return validate_amount(value, field=None, positive=True)

    def validate_date(self, value):
        return validate_business_date(value, field=None)

    def validate(self, attrs):
        """Keep a payment tied to its invoice and prevent overpayments."""
        invoice = attrs.get("invoice", getattr(self.instance, "invoice", None))
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))

        if invoice and customer and invoice.customer_id != customer.id:
            raise serializers.ValidationError({
                "customer": "The selected customer does not own this invoice.",
            })

        if invoice and amount is not None:
            existing_amount = self.instance.amount if self.instance else Decimal("0")
            outstanding = invoice.outstanding_balance + existing_amount
            if amount > outstanding:
                raise serializers.ValidationError({
                    "amount": f"Payment cannot exceed the outstanding balance of {outstanding}.",
                })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # Lock the invoice and re-check its balance to avoid concurrent
        # submissions creating an overpayment.
        invoice = Invoice.objects.select_for_update().get(pk=validated_data["invoice"].pk)
        if validated_data["customer"].pk != invoice.customer_id:
            raise serializers.ValidationError({
                "customer": "The selected customer does not own this invoice.",
            })
        if validated_data["amount"] > invoice.outstanding_balance:
            raise serializers.ValidationError({
                "amount": f"Payment cannot exceed the outstanding balance of {invoice.outstanding_balance}.",
            })

        validated_data["invoice"] = invoice
        payment = super().create(validated_data)
        invoice.amount_paid = (invoice.amount_paid or 0) + payment.amount
        invoice.recompute_status()
        invoice.save(update_fields=["amount_paid", "status", "updated_at"])
        return payment


# Small local helper so we don't shadow django.db.models.F.
from django.db.models import F as models_F  # noqa: E402
