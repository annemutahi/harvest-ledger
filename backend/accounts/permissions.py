"""Shared role-based permission classes.

Roles (see `accounts.roles`): Admin, Manager, Sales, Storekeeper, Viewer.
Each role maps to per-module actions (view/add/change/delete/approve).
Legacy helpers (`is_manager`, `IsManager`, ...) are kept so existing call
sites keep working; they now resolve through the role matrix.
"""
from rest_framework import permissions

from .roles import ADMIN, MANAGER, has_perm, role_for

METHOD_ACTION = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "add",
    "PUT": "change",
    "PATCH": "change",
    "DELETE": "delete",
}


def is_manager(user) -> bool:
    """True for Admin/Manager roles (previously: is_staff or is_superuser)."""
    return role_for(user) in (ADMIN, MANAGER)


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


class ModulePermission(permissions.BasePermission):
    """Generic per-module permission driven by the role matrix.

    Usage: `permission_classes = [module_permission("products")]`
    """

    module = ""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        action = METHOD_ACTION.get(request.method, "change")
        return has_perm(user, self.module, action)


def module_permission(module: str, name: str | None = None):
    return type(
        name or f"CanAccess{module.title()}",
        (ModulePermission,),
        {"module": module},
    )
