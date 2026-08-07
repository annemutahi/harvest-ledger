"""Account security: login lockout, password policy, breach (HIBP) check."""
from __future__ import annotations

import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 3
LOCKOUT_MINUTES = 15


class LoginAttempt(models.Model):
    """Failed sign-in counter per username (case-insensitive)."""

    username = models.CharField(max_length=150, unique=True)
    failures = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_failure_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "login attempt"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.username} ({self.failures})"


def _key(username: str) -> str:
    return (username or "").strip().lower()[:150]


def lock_seconds_remaining(username: str) -> int:
    row = LoginAttempt.objects.filter(username=_key(username)).first()
    if not row or not row.locked_until:
        return 0
    remaining = (row.locked_until - timezone.now()).total_seconds()
    return int(remaining) if remaining > 0 else 0


def register_failure(username: str) -> int:
    """Record a failed attempt; returns seconds locked (0 if not locked)."""
    row, _created = LoginAttempt.objects.get_or_create(username=_key(username))
    row.failures += 1
    row.last_failure_at = timezone.now()
    if row.failures >= MAX_FAILED_ATTEMPTS:
        row.locked_until = timezone.now() + timedelta(minutes=LOCKOUT_MINUTES)
    row.save()
    return lock_seconds_remaining(username)


def clear_failures(username: str) -> None:
    LoginAttempt.objects.filter(username=_key(username)).delete()


class ComplexityValidator:
    """Require upper, lower, digit and symbol characters."""

    def validate(self, password, user=None):
        missing = []
        if not any(c.islower() for c in password):
            missing.append(_("a lowercase letter"))
        if not any(c.isupper() for c in password):
            missing.append(_("an uppercase letter"))
        if not any(c.isdigit() for c in password):
            missing.append(_("a number"))
        if all(c.isalnum() for c in password):
            missing.append(_("a symbol"))
        if missing:
            raise ValidationError(
                _("Password must include %(missing)s.") % {"missing": ", ".join(missing)},
                code="password_not_complex",
            )

    def get_help_text(self):
        return _("Use at least one uppercase letter, lowercase letter, number and symbol.")


class BreachedPasswordValidator:
    """Check the password against Have I Been Pwned using k-anonymity.

    Only the first 5 characters of the SHA-1 hash ever leave the server.
    Network failures never block a password change.
    """

    api_url = "https://api.pwnedpasswords.com/range/"
    timeout = 3

    def validate(self, password, user=None):
        if not getattr(settings, "PASSWORD_BREACH_CHECK", True):
            return
        digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = digest[:5], digest[5:]
        try:
            import requests

            response = requests.get(
                f"{self.api_url}{prefix}",
                timeout=self.timeout,
                headers={"Add-Padding": "true", "User-Agent": "peaceful-acres-erp"},
            )
            response.raise_for_status()
            body = response.text
        except Exception:  # noqa: BLE001 - availability must not block resets
            logger.warning("Breach check unavailable; skipping.")
            return

        for line in body.splitlines():
            hash_suffix, _sep, count = line.partition(":")
            if hash_suffix.strip() == suffix and count.strip() not in ("", "0"):
                raise ValidationError(
                    _(
                        "This password has appeared in a known data breach. "
                        "Please choose a different one."
                    ),
                    code="password_breached",
                )

    def get_help_text(self):
        return _("Your password must not appear in known data breaches.")
