from rest_framework import serializers

from farm_erp.validators import validate_amount

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
        qs = Product.objects.filter(name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A product with this name already exists.")
        return value

    def validate_unit_price(self, value):
        return validate_amount(value, field=None)

    def validate_available_quantity(self, value):
        if value is None:
            raise serializers.ValidationError("Quantity must be >= 0.")
        if value < 0:
            raise serializers.ValidationError("Quantity must be >= 0.")
        if value > 1000000:
            raise serializers.ValidationError("Quantity is too large.")
        return value

    def create(self, validated_data):
        """Revive a soft-deleted product with the same name.

        `name` is unique at the database level but `validate_name` only sees
        live rows, so creating a product whose name matches a tombstoned row
        used to blow up with an IntegrityError (HTTP 500).
        """
        name = validated_data.get("name", "")
        existing = Product.all_objects.filter(name__iexact=name, is_deleted=True).first()
        if existing is None:
            return super().create(validated_data)
        for field, value in validated_data.items():
            setattr(existing, field, value)
        existing.is_deleted = False
        existing.deleted_at = None
        existing.deleted_by = None
        existing.active = True
        existing.save()
        return existing

