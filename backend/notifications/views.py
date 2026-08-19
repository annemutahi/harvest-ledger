from __future__ import annotations

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import NotificationState

MAX_KEYS = 200


def _keys(request) -> list[str]:
    raw = request.data.get("keys")
    if raw is None:
        raw = [request.data.get("key")] if request.data.get("key") else []
    if not isinstance(raw, list):
        return []
    out = []
    for k in raw[:MAX_KEYS]:
        k = str(k).strip()
        if k and len(k) <= 200:
            out.append(k)
    return out


def _state_payload(user) -> dict:
    rows = NotificationState.objects.filter(user=user)
    return {
        "read": [r.key for r in rows if r.read_at],
        "dismissed": [r.key for r in rows if r.dismissed_at],
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_state(request):
    """Keys this user has already read or dismissed."""
    return Response(_state_payload(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_read(request):
    now = timezone.now()
    for key in _keys(request):
        NotificationState.objects.update_or_create(
            user=request.user, key=key, defaults={"read_at": now}
        )
    return Response(_state_payload(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def dismiss(request):
    now = timezone.now()
    for key in _keys(request):
        NotificationState.objects.update_or_create(
            user=request.user, key=key, defaults={"read_at": now, "dismissed_at": now}
        )
    return Response(_state_payload(request.user))
