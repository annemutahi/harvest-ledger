from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "timestamp", "user", "username", "action",
            "model", "object_id", "object_repr", "changes", "ip_address",
        ]
        read_only_fields = fields
