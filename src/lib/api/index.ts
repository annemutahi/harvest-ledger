// Real API client — talks to Django REST Framework backend.
// Configure VITE_API_BASE_URL in .env (default: http://127.0.0.1:8000/api).

import type {
  Customer,
  Product,
  Sale,
  SaleItem,
  Invoice,
  Payment,
  InvoiceStatus,
  PaymentType,
  PaymentMethod,
  CustomerType,
} from "../mock-data";

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

export type AuthUser = { id: number | string; username: string; email?: string };

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

async function refreshAccessToken(): Promise<string> {
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

  if ((res.status === 401 || res.status === 403) && !init?.skipRefresh) {
    try {
      await refreshAccessToken();
      return await request(path, { ...init, skipRefresh: true });
    } catch (refreshError) {
      clearStoredAuth();
      const body = await res.text().catch(() => "");
      throw new ApiError(res.status, `API ${res.status} ${res.statusText} on ${path}: ${body}`);
    }
  }

  if (res.status === 401 || res.status === 403) clearStoredAuth();
  const body = await res.text().catch(() => "");
  throw new ApiError(res.status, `API ${res.status} ${res.statusText} on ${path}: ${body}`);
}

// DRF endpoints may return either a plain array or a paginated { results: [...] }.
function unwrap<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
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
  listSales: async (): Promise<Sale[]> =>
    unwrap<any>(await request("/sales/")).map(mapSale),
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

  // Invoices — /api/invoices/
  listInvoices: async (): Promise<Invoice[]> =>
    unwrap<any>(await request("/invoices/")).map(mapInvoice),
  getInvoice: async (id: string): Promise<Invoice> =>
    mapInvoice(await request(`/invoices/${id}/`)),

  // Payments — /api/payments/
  listPayments: async (): Promise<Payment[]> =>
    unwrap<any>(await request("/payments/")).map(mapPayment),
  createPayment: async (data: {
    invoiceId: string;
    customerId: string;
    amount: number;
    method: PaymentMethod;
    notes?: string;
  }): Promise<Payment> =>
    mapPayment(
      await request("/payments/", {
        method: "POST",
        body: JSON.stringify({
          invoice: data.invoiceId,
          customer: data.customerId,
          amount: data.amount,
          method: data.method.toLowerCase().replace(/ /g, "_"),
          notes: data.notes ?? "",
        }),
      }),
    ),
};
