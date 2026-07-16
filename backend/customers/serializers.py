from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.FloatField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id", "name", "type", "company", "contact_person",
            "phone", "email", "credit_limit", "outstanding_balance",
            "created_at",
        ]
        read_only_fields = ["created_at", "outstanding_balance"]

    def validate_name(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate_credit_limit(self, value):
        if value is None:
            return 0
        if value < 0:
            raise serializers.ValidationError("Credit limit cannot be negative.")
        return value
