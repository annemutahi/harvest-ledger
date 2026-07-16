from rest_framework import permissions

from accounts.permissions import is_manager


class CanEditSales(permissions.BasePermission):
    """Read for any authenticated user. Create/update/delete for managers only.

    Farmhands may create Cash sales at the till but never edit or delete
    historical sales.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == "POST":
            return True  # farmhands may record new sales
        return is_manager(request.user)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_manager(request.user)
