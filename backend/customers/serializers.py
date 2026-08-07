from rest_framework import serializers

from farm_erp.validators import normalize_email, normalize_phone, validate_amount

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

    def validate_phone(self, value):
        return normalize_phone(value, field=None)

    def validate_email(self, value):
        return normalize_email(value, field=None)

    def validate_credit_limit(self, value):
        if value is None:
            return 0
        return validate_amount(value, field=None)

    def validate(self, attrs):
        """Block duplicate customers on phone/email (case-insensitive)."""
        instance = self.instance
        for field, label in (("phone", "phone number"), ("email", "email address")):
            value = attrs.get(field, getattr(instance, field, "") if instance else "")
            if not value:
                continue
            qs = Customer.objects.filter(**{f"{field}__iexact": value})
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {field: f"Another customer already uses this {label}."}
                )
        return attrs

