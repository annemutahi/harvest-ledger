"""Per-user notification state.

Notifications themselves are derived from live business data (overdue
invoices, low stock, pending orders...). What must persist is which of
those alerts a user has already seen or dismissed, so the bell behaves the
same on every device. In-app only — nothing here sends email.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


class NotificationState(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_states",
    )
    key = models.CharField(max_length=200)
    read_at = models.DateTimeField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "key")
        indexes = [models.Index(fields=["user", "key"])]
        ordering = ["-updated_at"]

    def __str__(self) -> str:  # pragma: no cover - admin convenience
        return f"{self.user_id}:{self.key}"
