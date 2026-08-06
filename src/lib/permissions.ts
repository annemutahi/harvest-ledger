import type { AppRole, AuthUser } from "./api";

/** Modules that carry per-role rights (mirrors backend `accounts.roles`). */
export type Module =
  | "customers"
  | "products"
  | "sales"
  | "invoices"
  | "payments"
  | "stock"
  | "expenses"
  | "orders"
  | "reports"
  | "audit"
  | "users";

export type Action = "view" | "add" | "change" | "delete" | "approve";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
  storekeeper: "Storekeeper",
  viewer: "Viewer",
};

/** Fallback for tokens issued before roles existed. */
function fallbackRole(user: AuthUser): AppRole {
  if (user.is_superuser) return "admin";
  if (user.is_staff) return "manager";
  return "sales";
}

export function roleOf(user: AuthUser | null | undefined): AppRole | null {
  if (!user) return null;
  return (user.role as AppRole | undefined) ?? fallbackRole(user);
}

export function can(
  user: AuthUser | null | undefined,
  module: Module,
  action: Action = "view",
): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  const perms = user.permissions?.[module];
  if (perms) return perms.includes(action);
  // Legacy fallback: staff could do everything, others read-only.
  return action === "view" || Boolean(user.is_staff);
}

export function isManager(user: AuthUser | null | undefined): boolean {
  const role = roleOf(user);
  return role === "admin" || role === "manager";
}

// Allowed to edit historical sales.
export function canEditSales(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return can(user, "sales", "change") || Boolean(user.can_edit_sales);
}

// Managers can approve pending stock entries and manage products/pricing.
export function canManageProducts(user: AuthUser | null | undefined): boolean {
  return can(user, "products", "change");
}
