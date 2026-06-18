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
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000/api";

// Read a cookie by name (used for Django's CSRF token).
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCookie("csrftoken");
    if (csrf) headers["X-CSRFToken"] = csrf;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include", // send Django sessionid + csrftoken cookies
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, `API ${res.status} ${res.statusText} on ${path}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
  return {
    id: String(s.id),
    invoiceNumber: s.invoice_number ?? s.invoice?.invoice_number ?? "",
    customerId: String(s.customer ?? s.customer_id ?? ""),
    customerName: s.customer_name ?? "",
    date: s.date ?? s.created_at ?? "",
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
    invoiceDate: i.invoice_date ?? i.created_at ?? "",
    dueDate: i.due_date ?? "",
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

export type AuthUser = { id: number | string; username: string; email?: string };

export const api = {
  // Auth — Django session + CSRF.
  // Endpoints expected on the backend:
  //   GET  /api/auth/csrf/   -> sets csrftoken cookie (returns {detail:"ok"})
  //   POST /api/auth/login/  body {username, password} -> sets sessionid, returns user
  //   POST /api/auth/logout/ -> clears session
  //   GET  /api/auth/me/     -> returns current user, 401/403 if anonymous
  ensureCsrf: async (): Promise<void> => {
    await request("/auth/csrf/").catch(() => {});
  },
  login: async (username: string, password: string): Promise<AuthUser> => {
    await api.ensureCsrf();
    return request<AuthUser>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  logout: async (): Promise<void> => {
    await request("/auth/logout/", { method: "POST" }).catch(() => {});
  },
  me: async (): Promise<AuthUser> => request<AuthUser>("/auth/me/"),

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
          name: data.name,
          category: (data.category ?? "").toLowerCase().replace(/ /g, "_"),
          unit_price: data.unitPrice ?? 0,
          available_quantity: data.availableQuantity ?? 0,
          unit: data.unit ?? "piece",
          description: data.description ?? "",
        }),
      }),
    ),

  // Sales — /api/sales/
  listSales: async (): Promise<Sale[]> =>
    unwrap<any>(await request("/sales/")).map(mapSale),
  createSale: async (data: {
    customerId: string;
    paymentType: PaymentType;
    items: { productId: string; quantity: number; unitPrice: number }[];
  }): Promise<Sale> =>
    mapSale(
      await request("/sales/", {
        method: "POST",
        body: JSON.stringify({
          customer: data.customerId,
          payment_type: data.paymentType.toLowerCase(),
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
