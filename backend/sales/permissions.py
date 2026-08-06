from rest_framework import permissions

from accounts.roles import has_perm


class CanEditSales(permissions.BasePermission):
    """Read for anyone with sales view rights. Create for roles with `add`.

    Editing/deleting historical sales requires the `change`/`delete` right
    (Admin and Manager by default).
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return has_perm(user, "sales", "view")
        if request.method == "POST":
            return has_perm(user, "sales", "add")
        if request.method == "DELETE":
            return has_perm(user, "sales", "delete")
        return has_perm(user, "sales", "change")

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
