"""Audit-log and soft-delete building blocks.

`SoftDeleteModel` — abstract base: adds `is_deleted`, `deleted_at`, `deleted_by`
and swaps in a manager that hides tombstoned rows by default.

`AuditLog` — immutable record of who did what, when, and (best-effort) the
before/after payload for the affected row.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from .middleware import get_current_user


# --------------------------- Soft delete ---------------------------

class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        return super().update(
            is_deleted=True,
            deleted_at=timezone.now(),
        )

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    def __init__(self, *args, include_deleted: bool = False, **kwargs):
        super().__init__(*args, **kwargs)
        self._include_deleted = include_deleted

    def get_queryset(self):
        qs = SoftDeleteQuerySet(self.model, using=self._db)
        if self._include_deleted:
            return qs
        return qs.filter(is_deleted=False)


class SoftDeleteModel(models.Model):
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    objects = SoftDeleteManager()
    all_objects = SoftDeleteManager(include_deleted=True)

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        user = get_current_user()
        if user is not None and getattr(user, "is_authenticated", False):
            self.deleted_by = user
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])


# --------------------------- Audit log ---------------------------

class AuditLog(models.Model):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    LOGIN = "login"
    LOGOUT = "logout"
    ACTION_CHOICES = [
        (CREATE, "Create"),
        (UPDATE, "Update"),
        (DELETE, "Delete"),
        (RESTORE, "Restore"),
        (LOGIN, "Login"),
        (LOGOUT, "Logout"),
    ]

    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    username = models.CharField(max_length=150, blank=True, default="")
    action = models.CharField(max_length=16, choices=ACTION_CHOICES)
    model = models.CharField(max_length=100, db_index=True)
    object_id = models.CharField(max_length=64, blank=True, default="")
    object_repr = models.CharField(max_length=255, blank=True, default="")
    changes = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["model", "object_id"]),
            models.Index(fields=["action", "-timestamp"]),
        ]

    def __str__(self) -> str:
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.username or 'system'} {self.action} {self.model}#{self.object_id}"
