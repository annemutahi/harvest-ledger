from django.conf import settings
from django.db import models

from .roles import ROLE_CHOICES, SALES


class UserRole(models.Model):
    """One role per user. Drives the per-module permission matrix."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=SALES)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "user role"
        verbose_name_plural = "user roles"

    def __str__(self) -> str:
        return f"{self.user} — {self.role}"


# Imported so Django registers the login-lockout model with this app.
from .security import LoginAttempt  # noqa: E402,F401
