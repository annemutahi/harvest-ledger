from rest_framework import serializers

from products.models import Product

from .models import StockEntry


class StockEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = StockEntry
        fields = [
            "id", "product_name", "category", "quantity", "unit",
            "notes", "status", "matched_product", "recorded_by",
            "approved_by", "recorded_at", "updated_at",
        ]
        read_only_fields = ["status", "matched_product", "recorded_by",
                            "approved_by", "recorded_at", "updated_at"]

    def validate_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Quantity must be > 0.")
        return value

    def create(self, validated_data):
        name = validated_data.get("product_name", "").strip()
        match = Product.objects.filter(name__iexact=name).first() if name else None
        entry = StockEntry.objects.create(
            **validated_data,
            matched_product=match,
            status=StockEntry.MATCHED if match else StockEntry.PENDING,
        )
        return entry
