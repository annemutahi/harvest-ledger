from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "total"]
        read_only_fields = ["total"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = [
            "id", "reference", "external_id", "store_source", "channel", "status",
            "customer_name", "customer_phone", "customer_email", "delivery_address",
            "notes", "total", "items", "placed_at", "updated_at",
        ]
        read_only_fields = ["total", "placed_at", "updated_at"]

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
        total = sum(Decimal(i["quantity"]) * Decimal(i["unit_price"]) for i in items)
        if not validated_data.get("reference"):
            from django.utils.crypto import get_random_string
            validated_data["reference"] = f"ORD-{get_random_string(10).upper()}"
        order = Order.objects.create(total=total, **validated_data)
        for i in items:
            product = i.get("product")
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=i.get("product_name") or (product.name if product else ""),
                quantity=i["quantity"],
                unit_price=i["unit_price"],
            )
        return order
