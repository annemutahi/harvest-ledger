from rest_framework import serializers

from .models import CasualWage, CasualWorker, Purchase, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "notes", "created_at"]
        read_only_fields = ["created_at"]


class PurchaseSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id", "supplier", "supplier_name", "date", "category", "item",
            "quantity", "unit", "unit_cost", "total", "payment_method",
            "notes", "recorded_by", "created_at",
        ]
        read_only_fields = ["total", "recorded_by", "created_at"]

    def validate(self, attrs):
        if attrs.get("quantity", 0) <= 0:
            raise serializers.ValidationError({"quantity": "must be > 0"})
        if attrs.get("unit_cost", 0) < 0:
            raise serializers.ValidationError({"unit_cost": "must be >= 0"})
        supplier = attrs.get("supplier")
        if supplier and not attrs.get("supplier_name"):
            attrs["supplier_name"] = supplier.name
        return attrs


class CasualWorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CasualWorker
        fields = ["id", "name", "phone", "daily_rate", "active", "created_at"]
        read_only_fields = ["created_at"]


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
        if attrs.get("days_worked", 0) <= 0:
            raise serializers.ValidationError({"days_worked": "must be > 0"})
        if attrs.get("rate_per_day", 0) < 0:
            raise serializers.ValidationError({"rate_per_day": "must be >= 0"})
        worker = attrs.get("worker")
        if worker and not attrs.get("worker_name"):
            attrs["worker_name"] = worker.name
        return attrs
