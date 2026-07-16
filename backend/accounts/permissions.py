"""Shared role-based permission classes.

Managers = Django `is_staff` or `is_superuser`.
Farmhands = any other authenticated user.
"""
from rest_framework import permissions


def is_manager(user) -> bool:
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


class IsManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_manager(request.user)


class IsManagerOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return is_manager(request.user)


class ReadOnlyForFarmhands(permissions.BasePermission):
    """Everyone authenticated can read. Only managers can mutate."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_manager(request.user)
