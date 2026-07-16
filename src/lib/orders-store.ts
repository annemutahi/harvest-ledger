// Local store for customer orders (online + in-person) until backend endpoints exist.
// Online orders arrive via the webhook route at /api/public/orders/webhook.
// TODO(backend): replace with real API calls:
//   GET  /api/orders/                  list orders
//   POST /api/orders/                  create in-person order
//   GET  /api/orders/:id/              detail
//   PATCH /api/orders/:id/status/      update status (also pushes back to store)
//   POST /api/public/orders/webhook/   receives new orders from online store

export type OrderChannel = "online" | "in-person";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

export type OrderItem = {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Order = {
  id: string;
  reference: string; // external reference, e.g. store order #
  channel: OrderChannel;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  items: OrderItem[];
  total: number;
  notes?: string;
  status: OrderStatus;
  placedAt: string; // ISO
  updatedAt: string; // ISO
  storeSource?: string; // e.g. "shopify", "custom-store"
  externalId?: string; // id in the online store
};

const KEY = "peaceful_acres_orders";
const CHANGE_EVENT = "peaceful-acres-orders-changed";

function read(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

function write(orders: Order[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function makeId() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0")}`;
}

export const ordersStore = {
  changeEvent: CHANGE_EVENT,
  list: (): Order[] =>
    read().sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1)),
  get: (id: string): Order | undefined => read().find((o) => o.id === id),
  create: (
    input: Omit<Order, "id" | "placedAt" | "updatedAt" | "status" | "total"> & {
      status?: OrderStatus;
    },
  ): Order => {
    const now = new Date().toISOString();
    const total = input.items.reduce((s, i) => s + i.total, 0);
    const order: Order = {
      ...input,
      id: makeId(),
      status: input.status ?? "pending",
      total,
      placedAt: now,
      updatedAt: now,
    };
    const all = read();
    all.push(order);
    write(all);
    return order;
  },
  updateStatus: (id: string, status: OrderStatus): Order | undefined => {
    const all = read();
    const idx = all.findIndex((o) => o.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
    write(all);
    // TODO(backend): PATCH /api/orders/:id/status/ — Django view will push the
    // status back to the online store via its REST API (see backend guide).
    return all[idx];
  },
  countByStatus: (status: OrderStatus): number =>
    read().filter((o) => o.status === status).length,
};
