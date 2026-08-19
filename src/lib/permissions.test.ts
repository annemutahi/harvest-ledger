import { describe, expect, it } from "vitest";
import type { AuthUser } from "./api";
import { can, canEditSales, canManageProducts, isManager, roleOf } from "./permissions";

const user = (over: Partial<AuthUser> = {}): AuthUser =>
  ({
    id: 1,
    username: "u",
    email: "",
    is_staff: false,
    is_superuser: false,
    ...over,
  }) as AuthUser;

describe("roleOf", () => {
  it("uses the explicit role when present", () => {
    expect(roleOf(user({ role: "storekeeper" } as Partial<AuthUser>))).toBe("storekeeper");
  });

  it("falls back for legacy tokens", () => {
    expect(roleOf(user({ is_superuser: true }))).toBe("admin");
    expect(roleOf(user({ is_staff: true }))).toBe("manager");
    expect(roleOf(user())).toBe("sales");
    expect(roleOf(null)).toBeNull();
  });
});

describe("can", () => {
  it("denies anonymous users", () => {
    expect(can(null, "sales")).toBe(false);
  });

  it("allows superusers everything", () => {
    expect(can(user({ is_superuser: true }), "users", "delete")).toBe(true);
  });

  it("honours the permission matrix", () => {
    const storekeeper = user({
      role: "storekeeper",
      permissions: { stock: ["view", "add", "change"], users: [] },
    } as Partial<AuthUser>);
    expect(can(storekeeper, "stock", "add")).toBe(true);
    expect(can(storekeeper, "stock", "approve")).toBe(false);
    expect(can(storekeeper, "users", "view")).toBe(false);
  });

  it("falls back to read-only for legacy non-staff users", () => {
    expect(can(user(), "sales", "view")).toBe(true);
    expect(can(user(), "sales", "change")).toBe(false);
    expect(can(user({ is_staff: true }), "sales", "change")).toBe(true);
  });
});

describe("role helpers", () => {
  it("isManager covers admin and manager only", () => {
    expect(isManager(user({ role: "admin" } as Partial<AuthUser>))).toBe(true);
    expect(isManager(user({ role: "manager" } as Partial<AuthUser>))).toBe(true);
    expect(isManager(user({ role: "sales" } as Partial<AuthUser>))).toBe(false);
  });

  it("canEditSales requires the change right or the legacy flag", () => {
    expect(
      canEditSales(user({ role: "sales", permissions: { sales: ["view", "add"] } } as Partial<AuthUser>)),
    ).toBe(false);
    expect(
      canEditSales(user({ role: "sales", permissions: { sales: ["view", "change"] } } as Partial<AuthUser>)),
    ).toBe(true);
    expect(
      canEditSales(user({ permissions: { sales: [] }, can_edit_sales: true } as Partial<AuthUser>)),
    ).toBe(true);
  });

  it("canManageProducts needs product change rights", () => {
    expect(canManageProducts(user({ permissions: { products: ["view"] } } as Partial<AuthUser>))).toBe(
      false,
    );
    expect(
      canManageProducts(user({ permissions: { products: ["view", "change"] } } as Partial<AuthUser>)),
    ).toBe(true);
  });
});
