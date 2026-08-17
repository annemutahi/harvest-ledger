// Real API client — talks to Django REST Framework backend.
// Configure VITE_API_BASE_URL in .env (default: http://127.0.0.1:8000/api).

import type { Customer, Product, Sale, SaleItem, Invoice, InvoiceStatus, Payment, PaymentType, PaymentMethod, CustomerType } from "@/lib/types";

const API_BASE =
  (
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined)
  )?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000/api";

const ACCESS_TOKEN_KEY = "harvest_ledger_access_token";
const REFRESH_TOKEN_KEY = "harvest_ledger_refresh_token";
const REFRESH_ENDPOINT = "/auth/token/refresh/";
const USER_KEY = "harvest_ledger_user";
export const AUTH_CHANGED_EVENT = "harvest-ledger-auth-changed";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type AuthUser = {
  id: number | string;
  username: string;
  email?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  can_edit_sales?: boolean;
  role?: AppRole | null;
  permissions?: Record<string, string[]>;
};

export type AppRole = "admin" | "manager" | "sales" | "storekeeper" | "viewer";

export type RoleMatrixResponse = {
  modules: string[];
  roles: { value: AppRole; label: string }[];
  matrix: Record<string, Record<string, string[]>>;
};

type LoginResponse = {
  access?: string;
  refresh?: string;
  token?: string;
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
  id?: number | string;
  pk?: number | string;
  username?: string;
  email?: string;
};

function clearStoredAuth() {
  storage()?.removeItem(ACCESS_TOKEN_KEY);
  storage()?.removeItem(REFRESH_TOKEN_KEY);
  storage()?.removeItem(USER_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function getStoredUser(): AuthUser | null {
  const raw = storage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearStoredAuth();
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return JSON.parse(json) as Record<string, any>;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

function setAccessToken(token: string) {
  storage()?.setItem(ACCESS_TOKEN_KEY, token);
}

function setRefreshToken(token: string) {
  storage()?.setItem(REFRESH_TOKEN_KEY, token);
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // Single-flight: several parallel 401s must share ONE refresh call, otherwise
  // the losing calls fail and wipe the session while the user is mid-form.
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, "No refresh token available.");
  }

  const res = await fetch(`${API_BASE}${REFRESH_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!res.ok) {
    clearStoredAuth();
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, `Token refresh failed ${res.status} ${res.statusText}: ${body}`);
  }

  const data = (await res.json()) as LoginResponse;
  const accessToken = data.access ?? data.token ?? data.access_token;
  const newRefreshToken = data.refresh ?? data.refresh_token;

  if (!accessToken) {
    clearStoredAuth();
    throw new ApiError(500, "Refresh response did not include a new access token.");
  }

  setAccessToken(accessToken);
  if (newRefreshToken) setRefreshToken(newRefreshToken);
  return accessToken;
}


function setStoredAuth(auth: LoginResponse): AuthUser {
  const accessToken = auth.access ?? auth.token ?? auth.access_token;
  if (!accessToken) {
    throw new ApiError(500, "Login response did not include a JWT access token.");
  }

  storage()?.setItem(ACCESS_TOKEN_KEY, accessToken);
  const refreshToken = auth.refresh ?? auth.refresh_token;
  if (refreshToken) storage()?.setItem(REFRESH_TOKEN_KEY, refreshToken);

  const claims = decodeJwtPayload(accessToken);
  const user = auth.user ?? {
    id: auth.id ?? auth.pk ?? claims?.user_id ?? claims?.id ?? claims?.sub ?? auth.username ?? "authenticated",
    username: auth.username ?? claims?.username ?? claims?.email ?? claims?.sub ?? "authenticated",
    email: auth.email,
  };
  storage()?.setItem(USER_KEY, JSON.stringify(user));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  return user;
}

type RequestOptions = RequestInit & { skipRefresh?: boolean };

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // 403 = "you lack permission for this action" — NOT an expired session.
  // Signing the user out on 403 was killing open forms; only 401 refreshes/clears.
  if (res.status === 401 && !init?.skipRefresh) {
    try {
      await refreshAccessToken();
      return await request(path, { ...init, skipRefresh: true });
    } catch {
      clearStoredAuth();
      const body = await res.text().catch(() => "");
      throw new ApiError(res.status, `API ${res.status} ${res.statusText} on ${path}: ${body}`);
    }
  }

  if (res.status === 401) clearStoredAuth();
  const body = await res.text().catch(() => "");
  throw new ApiError(res.status, `API ${res.status} ${res.statusText} on ${path}: ${body}`);
}

// DRF endpoints may return either a plain array or a paginated { results: [...] }.
function unwrap<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
}

// Build a `?from=...&to=...` query string for list endpoints that
// support server-side date-range filtering. Returns "" when the caller
// passes nothing so existing call sites keep working.
function buildRange(params?: { from?: string; to?: string }): string {
  if (!params?.from && !params?.to) return "";
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return `?${qs.toString()}`;
}

// ---------- Mappers (snake_case -> camelCase) ----------

const cap = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s;

function mapCustomer(c: any): Customer {
  return {
    id: String(c.id),
    name: c.name,
    type: (cap(c.type ?? "individual") as CustomerType) || "Individual",
    company: c.company ?? undefined,
    contactPerson: c.contact_person ?? c.name ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    creditLimit: Number(c.credit_limit ?? 0),
    outstandingBalance: Number(c.outstanding_balance ?? 0),
    createdAt: c.created_at ?? c.createdAt ?? "",
  };
}

function mapProduct(p: any): Product {
  return {
    id: String(p.id),
    name: p.name,
    category: cap(p.category ?? ""),
    unitPrice: Number(p.unit_price ?? p.price ?? 0),
    availableQuantity: Number(p.available_quantity ?? p.quantity ?? 0),
    unit: p.unit ?? "piece",
    description: p.description ?? undefined,
  };
}

function mapItem(i: any): SaleItem {
  return {
    productId: String(i.product ?? i.product_id ?? ""),
    productName: i.product_name ?? i.name ?? "",
    quantity: Number(i.quantity ?? 0),
    unitPrice: Number(i.unit_price ?? 0),
    total: Number(i.line_total ?? i.total ?? 0),
  };
}

function mapSale(s: any): Sale {
  const invoiceObject = s.invoice ?? s.invoice_data ?? s.invoice_detail ?? {};
  const invoiceId = String(invoiceObject?.id ?? s.invoice ?? s.invoice_id ?? s.id ?? "");
  const invoiceNumber =
    s.invoice_number ??
    invoiceObject?.invoice_number ??
    invoiceObject?.number ??
    invoiceObject?.id ??
    "";

  return {
    id: String(s.id),
    invoiceId,
    invoiceNumber: String(invoiceNumber),
    customerId: String(s.customer ?? s.customer_id ?? ""),
    customerName: s.customer_name ?? "",
    date: s.date ?? s.created_at ?? s.issue_date ?? "",
    items: (s.items ?? []).map(mapItem),
    amount: Number(s.total ?? s.amount ?? 0),
    paymentType: (cap(s.payment_type ?? "cash") as PaymentType) || "Cash",
    status: (cap(s.status ?? "unpaid") as InvoiceStatus) || "Unpaid",
  };
}

function mapInvoice(i: any): Invoice {
  const total = Number(i.total_amount ?? i.total ?? 0);
  const paid = Number(i.amount_paid ?? 0);
  const pt = (i.payment_type ?? "").toString();
  return {
    id: String(i.id),
    invoiceNumber: i.invoice_number ?? "",
    customerId: String(i.customer ?? i.customer_id ?? ""),
    customerName: i.customer_name ?? "",
    invoiceDate: i.issue_date ?? i.date ?? i.created_at ?? "",
    dueDate: i.due_date ?? i.dueDate ?? i.date ??"",
    items: (i.items ?? []).map(mapItem),
    totalAmount: total,
    amountPaid: paid,
    outstandingBalance: Number(i.outstanding_balance ?? total - paid),
    status: (cap(i.status ?? "unpaid") as InvoiceStatus) || "Unpaid",
    saleId: i.sale_id != null ? String(i.sale_id) : undefined,
    paymentType: pt ? ((cap(pt) as PaymentType) || undefined) : undefined,
    adjustments: (i.adjustments ?? []).map((a: any) => ({
      id: String(a.id),
      kind: cap(a.kind ?? "credit") as "Debit" | "Credit",
      previousTotal: Number(a.previous_total ?? 0),
      newTotal: Number(a.new_total ?? 0),
      amount: Number(a.amount ?? 0),
      notes: a.notes || undefined,
      createdAt: a.created_at ?? "",
    })),
    creditApplied: Number(i.credit_applied ?? 0),
    availableCredit: Number(i.available_credit ?? 0),
    creditUses: (i.credit_uses ?? []).map((u: any) => ({
      id: String(u.id),
      amount: Number(u.amount ?? 0),
      targetInvoiceId: String(u.target_invoice ?? ""),
      targetInvoiceNumber: u.target_invoice_number ?? "",
      createdAt: u.created_at ?? "",
    })),
    etimsNumber: i.etims_number ?? "",
    isVoided: Boolean(i.is_voided ?? i.voided_at),
    voidedAt: i.voided_at ?? undefined,
    voidedByName: i.voided_by_name || undefined,
    voidReason: i.void_reason || undefined,
  };
}

function mapPayment(p: any): Payment {
  const methodRaw = (p.method ?? "cash").replace(/_/g, " ");
  return {
    id: String(p.id),
    date: p.date ?? p.created_at ?? "",
    customerId: String(p.customer ?? p.customer_id ?? ""),
    customerName: p.customer_name ?? "",
    invoiceId: String(p.invoice ?? p.invoice_id ?? ""),
    invoiceNumber: p.invoice_number ?? "",
    amount: Number(p.amount ?? 0),
    method: (methodRaw
      .split(" ")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") as PaymentMethod) || "Cash",
    notes: p.notes ?? undefined,
    isVoided: Boolean(p.is_voided ?? p.voided_at),
    voidedAt: p.voided_at ?? undefined,
    voidedByName: p.voided_by_name || undefined,
    voidReason: p.void_reason || undefined,
  };
}

// ---------- Public API ----------

export const api = {
  // Auth - JWT.
  // Endpoints expected on the backend:
  //   POST /api/auth/login/ body {username, password} -> returns {access, refresh?, user?}
  //   GET  /api/auth/me/    -> returns current user with Authorization: Bearer <access>
  ensureCsrf: async (): Promise<void> => {
    return Promise.resolve();
  },
  login: async (username: string, password: string): Promise<AuthUser> => {
    const auth = await request<LoginResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return setStoredAuth(auth);
  },
  logout: async (): Promise<void> => {
    // Best-effort: blacklist the refresh token server-side so it can't be reused.
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await fetch(`${API_BASE}/auth/token/blacklist/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh }),
        });
      } catch {
        // Ignore — we still clear local state below.
      }
    }
    clearStoredAuth();
  },
  me: async (): Promise<AuthUser> => {
    if (!getAccessToken()) throw new ApiError(401, "No auth token.");

    try {
      const user = await request<AuthUser>("/auth/me/");
      storage()?.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      const storedUser = getStoredUser();
      if (storedUser) return storedUser;
      throw error;
    }
  },

  requestPasswordReset: async (email: string): Promise<{ detail: string }> =>
    request<{ detail: string }>("/auth/password-reset/", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipRefresh: true,
    }),

  confirmPasswordReset: async (
    uid: string,
    token: string,
    password: string,
  ): Promise<{ detail: string }> =>
    request<{ detail: string }>("/auth/password-reset/confirm/", {
      method: "POST",
      body: JSON.stringify({ uid, token, password }),
      skipRefresh: true,
    }),

  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ detail: string }> =>
    request<{ detail: string }>("/auth/change-password/", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),


  // Customers — /api/customers/
  listCustomers: async (): Promise<Customer[]> =>
    unwrap<any>(await request("/customers/")).map(mapCustomer),
  getCustomer: async (id: string): Promise<Customer> =>
    mapCustomer(await request(`/customers/${id}/`)),
  createCustomer: async (data: Partial<Customer>): Promise<Customer> =>
    mapCustomer(
      await request("/customers/", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          type: (data.type ?? "Individual").toLowerCase(),
          company: data.company ?? "",
          contact_person: data.contactPerson,
          phone: data.phone,
          email: data.email,
          credit_limit: data.creditLimit ?? 0,
        }),
      }),
    ),

  // Products — /api/products/
  listProducts: async (): Promise<Product[]> =>
    unwrap<any>(await request("/products/")).map(mapProduct),
  createProduct: async (data: Partial<Product>): Promise<Product> =>
    mapProduct(
      await request("/products/", {
        method: "POST",
        body: JSON.stringify({
          name: data.name?.trim() ?? "",
          category: data.category?.trim() ?? "",
          unit_price: Number(data.unitPrice ?? 0),
          available_quantity: Number(data.availableQuantity ?? 0),
          description: data.description?.trim() ?? undefined,
        }),
      }),
    ),
  // Update a product by id
  updateProduct: async (id: string, data: Partial<Product>): Promise<Product> =>
    mapProduct(
      await request(`/products/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          category: data.category ? data.category.toLowerCase().replace(/ /g, "_") : undefined,
          unit_price: data.unitPrice,
          available_quantity: data.availableQuantity,
          description: data.description,
        }),
      }),
    ),
  // Delete a product by id
  deleteProduct: async (id: string): Promise<void> =>
    await request(`/products/${id}/`, {
      method: "DELETE",
    }),

  // Sales — /api/sales/
  listSales: async (params?: { from?: string; to?: string }): Promise<Sale[]> =>
    unwrap<any>(await request(`/sales/${buildRange(params)}`)).map(mapSale),
  createSale: async (data: {
    customerId: string;
    paymentType: PaymentType;
    invoiceDate?: string;
    dueDate?: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
  }): Promise<Sale> =>
    mapSale(
      await request("/sales/", {
        method: "POST",
        body: JSON.stringify({
          customer: data.customerId,
          payment_type: data.paymentType.toLowerCase(),
          date: data.invoiceDate,
          invoice_date: data.invoiceDate,
          due_date: data.dueDate,
          items: data.items.map((i) => ({
            product: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          })),
        }),
      }),
    ),
  getSale: async (id: string): Promise<Sale> =>
    mapSale(await request(`/sales/${id}/`)),
  updateSale: async (
    id: string,
    data: {
      customerId: string;
      paymentType: PaymentType;
      invoiceDate?: string;
      dueDate?: string;
      adjustmentNote?: string;
      items: { productId: string; quantity: number; unitPrice: number }[];
    },
  ): Promise<Sale> =>
    mapSale(
      await request(`/sales/${id}/`, {
        method: "PUT",
        body: JSON.stringify({
          customer: data.customerId,
          payment_type: data.paymentType.toLowerCase(),
          date: data.invoiceDate,
          invoice_date: data.invoiceDate,
          due_date: data.dueDate,
          adjustment_note: data.adjustmentNote ?? "",
          items: data.items.map((i) => ({
            product: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          })),
        }),
      }),
    ),
  deleteSale: async (id: string): Promise<void> =>
    await request(`/sales/${id}/`, { method: "DELETE" }),

  // Invoices — /api/invoices/
  listInvoices: async (params?: { from?: string; to?: string; customer?: string }): Promise<Invoice[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.customer) qs.set("customer", params.customer);
    // DRF paginates at 50 by default; request a large page so lookups
    // (e.g. picking an invoice to pay) aren't silently truncated.
    qs.set("page_size", "1000");
    return unwrap<any>(await request(`/invoices/?${qs.toString()}`)).map(mapInvoice);
  },
  getInvoice: async (id: string): Promise<Invoice> =>
    mapInvoice(await request(`/invoices/${id}/`)),
  updateInvoiceEtims: async (id: string, etimsNumber: string): Promise<Invoice> =>
    mapInvoice(
      await request(`/invoices/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ etims_number: etimsNumber }),
      }),
    ),

  voidInvoice: async (id: string, reason: string): Promise<Invoice> =>
    mapInvoice(
      await request(`/invoices/${id}/void/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    ),

  // Global search across customers, orders, invoices
  searchGlobal: async (q: string, limit = 10): Promise<{ customers: Customer[]; orders: ApiOrder[]; invoices: Invoice[] }> => {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("limit", String(limit));
    const raw: any = await request(`/search/?${qs.toString()}`);
    return {
      customers: (raw.customers || []).map(mapCustomer),
      orders: (raw.orders || []).map(mapOrder),
      invoices: (raw.invoices || []).map(mapInvoice),
    };
  },

  // Payments — /api/payments/
  listPayments: async (params?: { from?: string; to?: string }): Promise<Payment[]> =>
    unwrap<any>(await request(`/payments/${buildRange(params)}`)).map(mapPayment),
  getPayment: async (id: string): Promise<Payment> =>
    mapPayment(await request(`/payments/${id}/`)),
  createPayment: async (data: {
    invoiceId: string;
    customerId: string;
    amount: number;
    method: PaymentMethod;
    notes?: string;
    /** Stable per-submission key so retries/double-clicks can't duplicate. */
    idempotencyKey?: string;
  }): Promise<Payment> =>
    mapPayment(
      await request("/payments/", {
        method: "POST",
        headers: data.idempotencyKey ? { "Idempotency-Key": data.idempotencyKey } : undefined,
        body: JSON.stringify({
          invoice: data.invoiceId,
          customer: data.customerId,
          amount: data.amount,
          method: data.method.toLowerCase().replace(/ /g, "_"),
          notes: data.notes ?? "",
          idempotency_key: data.idempotencyKey ?? null,
        }),
      }),
    ),

  voidPayment: async (id: string, reason: string): Promise<Payment> =>
    mapPayment(
      await request(`/payments/${id}/void/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    ),

  // ---------- Expenses: Suppliers ----------
  listSuppliers: async (): Promise<ApiSupplier[]> =>
    unwrap<any>(await request("/suppliers/")).map(mapSupplier),
  createSupplier: async (data: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }): Promise<ApiSupplier> =>
    mapSupplier(
      await request("/suppliers/", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          contact_person: data.contactPerson ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          notes: data.notes ?? "",
        }),
      }),
    ),
  deleteSupplier: async (id: string): Promise<void> =>
    await request(`/suppliers/${id}/`, { method: "DELETE" }),

  // ---------- Expenses: Purchases ----------
  listPurchases: async (params?: { from?: string; to?: string }): Promise<ApiPurchase[]> =>
    unwrap<any>(await request(`/purchases/${buildRange(params)}`)).map(mapPurchase),
  createPurchase: async (data: {
    supplierId?: string;
    supplierName: string;
    date: string;
    category: string;
    item: string;
    quantity: number;
    unit?: string;
    unitCost: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<ApiPurchase> =>
    mapPurchase(
      await request("/purchases/", {
        method: "POST",
        body: JSON.stringify({
          supplier: data.supplierId ? Number(data.supplierId) || data.supplierId : null,
          supplier_name: data.supplierName,
          date: data.date,
          category: data.category,
          item: data.item,
          quantity: data.quantity,
          unit: data.unit ?? "",
          unit_cost: data.unitCost,
          payment_method: data.paymentMethod ?? "",
          notes: data.notes ?? "",
        }),
      }),
    ),
  setPurchasePaid: async (id: string, paid: boolean): Promise<ApiPurchase> =>
    mapPurchase(
      await request(`/purchases/${id}/set-paid/`, {
        method: "POST",
        body: JSON.stringify({ paid }),
      }),
    ),
  deletePurchase: async (id: string): Promise<void> =>
    await request(`/purchases/${id}/`, { method: "DELETE" }),

  // ---------- Expenses: Casual workers ----------
  listCasualWorkers: async (): Promise<ApiCasualWorker[]> =>
    unwrap<any>(await request("/casual-workers/")).map(mapCasualWorker),
  createCasualWorker: async (data: {
    name: string;
    phone?: string;
    dailyRate: number;
  }): Promise<ApiCasualWorker> =>
    mapCasualWorker(
      await request("/casual-workers/", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          phone: data.phone ?? "",
          daily_rate: data.dailyRate,
          active: true,
        }),
      }),
    ),
  updateCasualWorker: async (
    id: string,
    patch: Partial<{ name: string; phone: string; dailyRate: number; active: boolean }>,
  ): Promise<ApiCasualWorker> => {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (patch.dailyRate !== undefined) body.daily_rate = patch.dailyRate;
    if (patch.active !== undefined) body.active = patch.active;
    return mapCasualWorker(
      await request(`/casual-workers/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },
  deleteCasualWorker: async (id: string): Promise<void> =>
    await request(`/casual-workers/${id}/`, { method: "DELETE" }),

  // ---------- Expenses: Casual wages ----------
  listCasualWages: async (params?: { from?: string; to?: string }): Promise<ApiCasualWage[]> =>
    unwrap<any>(await request(`/casual-wages/${buildRange(params)}`)).map(mapCasualWage),
  createCasualWage: async (data: {
    workerId?: string;
    workerName: string;
    date: string;
    daysWorked: number;
    ratePerDay: number;
    task?: string;
    paid?: boolean;
    notes?: string;
  }): Promise<ApiCasualWage> =>
    mapCasualWage(
      await request("/casual-wages/", {
        method: "POST",
        body: JSON.stringify({
          worker: data.workerId ? Number(data.workerId) || data.workerId : null,
          worker_name: data.workerName,
          date: data.date,
          days_worked: data.daysWorked,
          rate_per_day: data.ratePerDay,
          task: data.task ?? "",
          paid: !!data.paid,
          notes: data.notes ?? "",
        }),
      }),
    ),
  markCasualWagePaid: async (id: string): Promise<ApiCasualWage> =>
    mapCasualWage(
      await request(`/casual-wages/${id}/mark-paid/`, { method: "POST" }),
    ),
  updateCasualWage: async (
    id: string,
    patch: Partial<{
      date: string;
      daysWorked: number;
      ratePerDay: number;
      task: string;
      notes: string;
      paid: boolean;
    }>,
  ): Promise<ApiCasualWage> => {
    const body: Record<string, unknown> = {};
    if (patch.date !== undefined) body.date = patch.date;
    if (patch.daysWorked !== undefined) body.days_worked = patch.daysWorked;
    if (patch.ratePerDay !== undefined) body.rate_per_day = patch.ratePerDay;
    if (patch.task !== undefined) body.task = patch.task;
    if (patch.notes !== undefined) body.notes = patch.notes;
    if (patch.paid !== undefined) body.paid = patch.paid;
    return mapCasualWage(
      await request(`/casual-wages/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },
  deleteCasualWage: async (id: string): Promise<void> =>
    await request(`/casual-wages/${id}/`, { method: "DELETE" }),

  // ---------- Orders ----------
  listOrders: async (params?: { from?: string; to?: string }): Promise<ApiOrder[]> =>
    unwrap<any>(await request(`/orders/${buildRange(params)}`)).map(mapOrder),
  getOrder: async (id: string): Promise<ApiOrder> =>
    mapOrder(await request(`/orders/${id}/`)),
  createOrder: async (data: {
    reference?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    deliveryAddress?: string;
    notes?: string;
    items: { productId?: string; productName: string; quantity: number; unitPrice: number }[];
    status?: ApiOrderStatus;
  }): Promise<ApiOrder> =>
    mapOrder(
      await request("/orders/", {
        method: "POST",
        body: JSON.stringify({
          reference: data.reference,
          channel: "in-person",
          status: data.status ?? "confirmed",
          customer_name: data.customerName,
          customer_phone: data.customerPhone ?? "",
          customer_email: data.customerEmail ?? "",
          delivery_address: data.deliveryAddress ?? "",
          notes: data.notes ?? "",
          items: data.items.map((i) => ({
            product: i.productId ? Number(i.productId) || i.productId : null,
            product_name: i.productName,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          })),
        }),
      }),
    ),
  updateOrderStatus: async (id: string, status: ApiOrderStatus): Promise<ApiOrder> =>
    mapOrder(
      await request(`/orders/${id}/status/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    ),

  // ---------- Stock (daily produce entries) — /api/stock/ ----------
  listStockEntries: async (params?: { from?: string; to?: string }): Promise<ApiStockEntry[]> =>
    unwrap<any>(await request(`/stock/${buildRange(params)}`)).map(mapStockEntry),
  createStockEntry: async (data: {
    productName: string;
    category?: string;
    quantity: number;
    unit?: string;
    notes?: string;
  }): Promise<ApiStockEntry> =>
    mapStockEntry(
      await request("/stock/", {
        method: "POST",
        body: JSON.stringify({
          product_name: data.productName,
          category: data.category ?? "",
          quantity: data.quantity,
          unit: data.unit ?? "",
          notes: data.notes ?? "",
        }),
      }),
    ),
  approveStockEntry: async (id: string, productId?: string): Promise<ApiStockEntry> =>
    mapStockEntry(
      await request(`/stock/${id}/approve/`, {
        method: "PATCH",
        body: JSON.stringify(productId ? { product_id: productId } : {}),
      }),
    ),
  rejectStockEntry: async (id: string): Promise<ApiStockEntry> =>
    mapStockEntry(
      await request(`/stock/${id}/reject/`, { method: "PATCH" }),
    ),

  // ---------- Reports ----------
  getDashboardSummary: async (params?: { from?: string; to?: string }): Promise<DashboardSummary> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    const raw: any = await request(`/reports/summary/${q ? `?${q}` : ""}`);
    return {
      from: raw.from ?? "",
      to: raw.to ?? "",
      sales: {
        invoices: Number(raw.sales?.invoices ?? 0),
        deliveredOrders: Number(raw.sales?.delivered_orders ?? 0),
        total: Number(raw.sales?.total ?? 0),
      },
      expenses: {
        purchases: Number(raw.expenses?.purchases ?? 0),
        wages: Number(raw.expenses?.wages ?? 0),
        total: Number(raw.expenses?.total ?? 0),
        purchasesPaid: Number(raw.expenses?.purchases_paid ?? 0),
        wagesPaid: Number(raw.expenses?.wages_paid ?? 0),
        paidTotal: Number(raw.expenses?.paid_total ?? 0),
      },
      profit: Number(raw.profit ?? 0),
      receivablesOutstanding: Number(raw.receivables_outstanding ?? 0),
      deliveredOrdersCount: Number(raw.delivered_orders_count ?? 0),
    };
  },

  // ---------- Audit log — /api/audit/logs/ (managers only) ----------
  listAuditLogs: async (params?: {
    model?: string;
    action?: string;
    search?: string;
    page?: number;
  }): Promise<ApiAuditLog[]> => {
    const qs = new URLSearchParams();
    if (params?.model) qs.set("model", params.model);
    if (params?.action) qs.set("action", params.action);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    const q = qs.toString();
    return unwrap<any>(await request(`/audit/logs/${q ? `?${q}` : ""}`)).map(mapAuditLog);
  },

  listUsers: async (): Promise<AuthUser[]> =>
    unwrap<AuthUser>(await request("/auth/users/")),

  setUserRole: async (id: number | string, role: AppRole): Promise<AuthUser> =>
    request(`/auth/users/${id}/`, { method: "PATCH", body: JSON.stringify({ role }) }),

  roleMatrix: async (): Promise<RoleMatrixResponse> => request("/auth/roles/"),
};

export type ApiAuditLog = {
  id: string;
  timestamp: string;
  username: string;
  action: "create" | "update" | "delete" | "restore" | "login" | "logout";
  model: string;
  objectId: string;
  objectRepr: string;
  changes: any;
  ipAddress: string | null;
};

function mapAuditLog(a: any): ApiAuditLog {
  return {
    id: String(a.id),
    timestamp: a.timestamp ?? "",
    username: a.username ?? "",
    action: a.action,
    model: a.model ?? "",
    objectId: String(a.object_id ?? ""),
    objectRepr: a.object_repr ?? "",
    changes: a.changes ?? null,
    ipAddress: a.ip_address ?? null,
  };
}


export type DashboardSummary = {
  from: string;
  to: string;
  sales: { invoices: number; deliveredOrders: number; total: number };
  expenses: {
    purchases: number;
    wages: number;
    total: number;
    purchasesPaid: number;
    wagesPaid: number;
    paidTotal: number;
  };
  profit: number;
  receivablesOutstanding: number;
  deliveredOrdersCount: number;
};

export type ApiStockEntryStatus = "matched" | "pending" | "approved" | "rejected";

export type ApiStockEntry = {
  id: string;
  productName: string;
  category: string;
  quantity: number;
  unit?: string;
  notes?: string;
  status: ApiStockEntryStatus;
  matchedProductId?: string;
  recordedBy?: string;
  approvedBy?: string;
  recordedAt: string;
  updatedAt: string;
};

function mapStockEntry(s: any): ApiStockEntry {
  return {
    id: String(s.id),
    productName: s.product_name ?? "",
    category: s.category ?? "",
    quantity: Number(s.quantity ?? 0),
    unit: s.unit || undefined,
    notes: s.notes || undefined,
    status: (s.status ?? "pending") as ApiStockEntryStatus,
    matchedProductId: s.matched_product != null ? String(s.matched_product) : undefined,
    recordedBy: s.recorded_by_username ?? (s.recorded_by != null ? String(s.recorded_by) : undefined),
    approvedBy: s.approved_by != null ? String(s.approved_by) : undefined,
    recordedAt: s.recorded_at ?? "",
    updatedAt: s.updated_at ?? "",
  };
}

// ---------- Expense DTOs and mappers ----------

export type ApiSupplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
};

export type ApiPurchase = {
  id: string;
  supplierId?: string;
  supplierName: string;
  date: string;
  category: string;
  item: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  total: number;
  paymentMethod?: string;
  paid: boolean;
  paidAt?: string;
  notes?: string;
  recordedBy?: string;
};

export type ApiCasualWorker = {
  id: string;
  name: string;
  phone?: string;
  dailyRate: number;
  active: boolean;
  createdAt: string;
};

export type ApiCasualWage = {
  id: string;
  workerId?: string;
  workerName: string;
  date: string;
  daysWorked: number;
  ratePerDay: number;
  total: number;
  task?: string;
  paid: boolean;
  paidAt?: string;
  notes?: string;
  recordedBy?: string;
};

function mapSupplier(s: any): ApiSupplier {
  return {
    id: String(s.id),
    name: s.name ?? "",
    contactPerson: s.contact_person || undefined,
    phone: s.phone || undefined,
    email: s.email || undefined,
    notes: s.notes || undefined,
    createdAt: s.created_at ?? "",
  };
}

function mapPurchase(p: any): ApiPurchase {
  return {
    id: String(p.id),
    supplierId: p.supplier != null ? String(p.supplier) : undefined,
    supplierName: p.supplier_name ?? "",
    date: p.date ?? "",
    category: p.category ?? "",
    item: p.item ?? "",
    quantity: Number(p.quantity ?? 0),
    unit: p.unit || undefined,
    unitCost: Number(p.unit_cost ?? 0),
    total: Number(p.total ?? 0),
    paymentMethod: p.payment_method || undefined,
    paid: Boolean(p.paid),
    paidAt: p.paid_at || undefined,
    notes: p.notes || undefined,
    recordedBy: p.recorded_by ? String(p.recorded_by) : undefined,
  };
}

function mapCasualWorker(w: any): ApiCasualWorker {
  return {
    id: String(w.id),
    name: w.name ?? "",
    phone: w.phone || undefined,
    dailyRate: Number(w.daily_rate ?? 0),
    active: !!w.active,
    createdAt: w.created_at ?? "",
  };
}

function mapCasualWage(w: any): ApiCasualWage {
  return {
    id: String(w.id),
    workerId: w.worker != null ? String(w.worker) : undefined,
    workerName: w.worker_name ?? "",
    date: w.date ?? "",
    daysWorked: Number(w.days_worked ?? 0),
    ratePerDay: Number(w.rate_per_day ?? 0),
    total: Number(w.total ?? 0),
    task: w.task || undefined,
    paid: !!w.paid,
    paidAt: w.paid_at || undefined,
    notes: w.notes || undefined,
    recordedBy: w.recorded_by ? String(w.recorded_by) : undefined,
  };
}


// ---------- Order DTOs and mappers ----------

export type ApiOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type ApiOrderChannel = "online" | "in-person";

export type ApiOrderItem = {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ApiOrder = {
  id: string;
  reference: string;
  externalId?: string;
  storeSource?: string;
  channel: ApiOrderChannel;
  status: ApiOrderStatus;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  notes?: string;
  total: number;
  items: ApiOrderItem[];
  placedAt: string;
  updatedAt: string;
};

function mapOrderItem(i: any): ApiOrderItem {
  return {
    productId: i.product != null ? String(i.product) : undefined,
    productName: i.product_name ?? "",
    quantity: Number(i.quantity ?? 0),
    unitPrice: Number(i.unit_price ?? 0),
    total: Number(i.total ?? 0),
  };
}

function mapOrder(o: any): ApiOrder {
  return {
    id: String(o.id),
    reference: o.reference ?? "",
    externalId: o.external_id || undefined,
    storeSource: o.store_source || undefined,
    channel: (o.channel ?? "in-person") as ApiOrderChannel,
    status: (o.status ?? "pending") as ApiOrderStatus,
    customerName: o.customer_name ?? "",
    customerPhone: o.customer_phone || undefined,
    customerEmail: o.customer_email || undefined,
    deliveryAddress: o.delivery_address || undefined,
    notes: o.notes || undefined,
    total: Number(o.total ?? 0),
    items: (o.items ?? []).map(mapOrderItem),
    placedAt: o.placed_at ?? "",
    updatedAt: o.updated_at ?? "",
  };
}
