from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id", "name", "category", "unit_price", "available_quantity",
            "unit", "description", "active", "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_name(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate_unit_price(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("Unit price must be >= 0.")
        return value

    def validate_available_quantity(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("Quantity must be >= 0.")
        return value
