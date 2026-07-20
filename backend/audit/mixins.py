"""DRF ViewSet mixin that writes an AuditLog row on every mutation."""
from __future__ import annotations

from typing import Any

from django.core.serializers.json import DjangoJSONEncoder
from django.forms.models import model_to_dict

from .models import AuditLog


def _client_ip(request) -> str | None:
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def _safe_snapshot(instance) -> dict[str, Any]:
    """Best-effort JSON-friendly snapshot of a model instance."""
    try:
        data = model_to_dict(instance)
    except Exception:
        return {}
    # DjangoJSONEncoder handles Decimal/date/datetime.
    import json
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder, default=str))


class AuditedModelViewSetMixin:
    """Drop-in mixin: records create/update/delete against AuditLog.

    Sits BEFORE ModelViewSet in MRO:
        class CustomerViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
            ...
    """

    audit_model_name: str | None = None

    def _audit(self, action: str, instance, changes: dict[str, Any] | None = None) -> None:
        user = getattr(self.request, "user", None)
        AuditLog.objects.create(
            user=user if getattr(user, "is_authenticated", False) else None,
            username=getattr(user, "username", "") or "",
            action=action,
            model=self.audit_model_name or instance.__class__.__name__,
            object_id=str(getattr(instance, "pk", "")),
            object_repr=str(instance)[:255],
            changes=changes,
            ip_address=_client_ip(self.request),
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._audit(AuditLog.CREATE, instance, {"after": _safe_snapshot(instance)})
        return instance

    def perform_update(self, serializer):
        before = _safe_snapshot(serializer.instance)
        instance = serializer.save()
        after = _safe_snapshot(instance)
        diff = {k: {"from": before.get(k), "to": after.get(k)}
                for k in set(before) | set(after)
                if before.get(k) != after.get(k)}
        self._audit(AuditLog.UPDATE, instance, {"diff": diff} if diff else None)
        return instance

    def perform_destroy(self, instance):
        snapshot = _safe_snapshot(instance)
        self._audit(AuditLog.DELETE, instance, {"before": snapshot})
        instance.delete()  # SoftDeleteModel.delete() tombstones; others hard-delete.
