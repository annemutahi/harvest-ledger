"""Role / permission matrix for the ERP.

A user has exactly one role (stored on `accounts.UserRole`). Each role grants
a set of actions per module. Legacy Django flags remain a fallback so existing
accounts keep working before roles are assigned:

* superuser -> ADMIN
* is_staff  -> MANAGER
* otherwise -> SALES (the old "farmhand" capability set)
"""
from __future__ import annotations

ADMIN = "admin"
MANAGER = "manager"
SALES = "sales"
STOREKEEPER = "storekeeper"
VIEWER = "viewer"

ROLE_CHOICES = [
    (ADMIN, "Admin"),
    (MANAGER, "Manager"),
    (SALES, "Sales"),
    (STOREKEEPER, "Storekeeper"),
    (VIEWER, "Viewer"),
]

MODULES = [
    "customers",
    "products",
    "sales",
    "invoices",
    "payments",
    "stock",
    "expenses",
    "orders",
    "reports",
    "audit",
    "users",
]

VIEW, ADD, CHANGE, DELETE, APPROVE = "view", "add", "change", "delete", "approve"
ALL = [VIEW, ADD, CHANGE, DELETE, APPROVE]

_VIEW_ONLY = [VIEW]

ROLE_MATRIX: dict[str, dict[str, list[str]]] = {
    ADMIN: {module: list(ALL) for module in MODULES},
    MANAGER: {
        **{module: list(ALL) for module in MODULES},
        "users": _VIEW_ONLY,
        "audit": _VIEW_ONLY,
    },
    SALES: {
        "customers": [VIEW, ADD, CHANGE],
        "products": _VIEW_ONLY,
        "sales": [VIEW, ADD],
        "invoices": [VIEW],
        "payments": [VIEW, ADD],
        "stock": [VIEW, ADD],
        "expenses": _VIEW_ONLY,
        "orders": [VIEW, CHANGE],
        "reports": _VIEW_ONLY,
        "audit": [],
        "users": [],
    },
    STOREKEEPER: {
        "customers": _VIEW_ONLY,
        "products": [VIEW, ADD, CHANGE],
        "sales": _VIEW_ONLY,
        "invoices": _VIEW_ONLY,
        "payments": [],
        "stock": [VIEW, ADD, CHANGE],
        "expenses": [VIEW, ADD],
        "orders": [VIEW, CHANGE],
        "reports": _VIEW_ONLY,
        "audit": [],
        "users": [],
    },
    VIEWER: {
        **{module: list(_VIEW_ONLY) for module in MODULES},
        "audit": [],
        "users": [],
    },
}


def role_for(user) -> str | None:
    """Resolve a user's role, falling back to the legacy staff flags."""
    if not (user and getattr(user, "is_authenticated", False)):
        return None
    stored = getattr(getattr(user, "role_profile", None), "role", None)
    if stored:
        return stored
    if user.is_superuser:
        return ADMIN
    if user.is_staff:
        return MANAGER
    return SALES


def permissions_for(user) -> dict[str, list[str]]:
    role = role_for(user)
    if not role:
        return {module: [] for module in MODULES}
    matrix = ROLE_MATRIX.get(role, {})
    return {module: list(matrix.get(module, [])) for module in MODULES}


def has_perm(user, module: str, action: str) -> bool:
    if not (user and getattr(user, "is_authenticated", False)):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return action in permissions_for(user).get(module, [])
