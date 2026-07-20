from rest_framework import viewsets

from accounts.permissions import IsManager

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Managers-only read-only view over the audit trail."""

    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsManager]
    filterset_fields = ["action", "model", "user", "username"]
    search_fields = ["object_repr", "object_id", "username"]
    ordering_fields = ["timestamp"]
    ordering = ["-timestamp"]
