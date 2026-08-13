from rest_framework import serializers

from farm_erp.validators import (
    normalize_email,
    normalize_phone,
    validate_amount,
    validate_business_date,
    validate_quantity,
)

from .models import CasualWage, CasualWorker, Purchase, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "notes", "created_at"]
        read_only_fields = ["created_at"]

    def validate_phone(self, value):
        return normalize_phone(value, field=None)

    def validate_email(self, value):
        return normalize_email(value, field=None)


class PurchaseSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id", "supplier", "supplier_name", "date", "category", "item",
            "quantity", "unit", "unit_cost", "total", "payment_method",
            "paid", "paid_at", "notes", "recorded_by", "created_at",
        ]
        read_only_fields = ["total", "paid_at", "recorded_by", "created_at"]

    def validate(self, attrs):
        if "quantity" in attrs:
            attrs["quantity"] = validate_quantity(attrs["quantity"])
        if "unit_cost" in attrs:
            attrs["unit_cost"] = validate_amount(attrs["unit_cost"], field="unit_cost")
        if attrs.get("date"):
            validate_business_date(attrs["date"], field="date")
        supplier = attrs.get("supplier")
        if supplier and not attrs.get("supplier_name"):
            attrs["supplier_name"] = supplier.name
        return attrs


class CasualWorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CasualWorker
        fields = ["id", "name", "phone", "daily_rate", "active", "created_at"]
        read_only_fields = ["created_at"]

    def validate_phone(self, value):
        return normalize_phone(value, field=None)

    def validate_daily_rate(self, value):
        return validate_amount(value, field=None)


class CasualWageSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = CasualWage
        fields = [
            "id", "worker", "worker_name", "date", "days_worked",
            "rate_per_day", "total", "task", "paid", "paid_at",
            "notes", "recorded_by", "created_at",
        ]
        read_only_fields = ["total", "paid_at", "recorded_by", "created_at"]

    def validate(self, attrs):
        if "days_worked" in attrs:
            attrs["days_worked"] = validate_quantity(attrs["days_worked"], field="days_worked")
        if "rate_per_day" in attrs:
            attrs["rate_per_day"] = validate_amount(attrs["rate_per_day"], field="rate_per_day")
        if attrs.get("date"):
            validate_business_date(attrs["date"], field="date")
        worker = attrs.get("worker")
        if worker and not attrs.get("worker_name"):
            attrs["worker_name"] = worker.name
        return attrs
