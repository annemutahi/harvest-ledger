import type { AuthUser } from "./api";

// Allowed to edit sales: superusers and staff (Django is_staff flag).
export function canEditSales(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.is_superuser || user.is_staff || user.can_edit_sales);
}

// Managers (staff/superusers) can approve pending stock entries and add new
// products with prices. Farmhands (non-staff) can only record stock.
export function canManageProducts(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.is_superuser || user.is_staff);
}
