// Local store for expense records (purchases & casual wages) until backend
// endpoints exist. Backed by localStorage so data persists per browser.
// TODO(backend): replace with real API calls:
//   GET/POST /api/suppliers/
//   GET/POST /api/purchases/
//   GET/POST /api/casuals/
//   GET/POST /api/casual-wages/

export type Supplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
};

export type Purchase = {
  id: string;
  supplierId?: string;
  supplierName: string;
  date: string; // ISO date
  category: string; // e.g. Feed, Veterinary, Equipment, Utilities
  item: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  total: number;
  paymentMethod?: string;
  notes?: string;
  recordedBy?: string;
};

export type CasualWorker = {
  id: string;
  name: string;
  phone?: string;
  dailyRate: number;
  createdAt: string;
};

export type CasualWage = {
  id: string;
  workerId?: string;
  workerName: string;
  date: string;
  daysWorked: number;
  ratePerDay: number;
  total: number;
  task?: string;
  paid: boolean;
  notes?: string;
  recordedBy?: string;
};

const K_SUPPLIERS = "peaceful_acres_suppliers";
const K_PURCHASES = "peaceful_acres_purchases";
const K_WORKERS = "peaceful_acres_casual_workers";
const K_WAGES = "peaceful_acres_casual_wages";
const CHANGE_EVENT = "peaceful-acres-expenses-changed";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const EXPENSES_CHANGE_EVENT = CHANGE_EVENT;

export const expensesStore = {
  // Suppliers
  listSuppliers: (): Supplier[] =>
    read<Supplier>(K_SUPPLIERS).sort((a, b) => a.name.localeCompare(b.name)),
  addSupplier: (data: Omit<Supplier, "id" | "createdAt">): Supplier => {
    const created: Supplier = { ...data, id: uid(), createdAt: new Date().toISOString() };
    write(K_SUPPLIERS, [created, ...read<Supplier>(K_SUPPLIERS)]);
    return created;
  },
  removeSupplier: (id: string) => {
    write(K_SUPPLIERS, read<Supplier>(K_SUPPLIERS).filter((s) => s.id !== id));
  },

  // Purchases
  listPurchases: (): Purchase[] =>
    read<Purchase>(K_PURCHASES).sort((a, b) => (a.date < b.date ? 1 : -1)),
  addPurchase: (data: Omit<Purchase, "id">): Purchase => {
    const created: Purchase = { ...data, id: uid() };
    write(K_PURCHASES, [created, ...read<Purchase>(K_PURCHASES)]);
    return created;
  },
  updatePurchase: (id: string, patch: Partial<Purchase>) => {
    write(
      K_PURCHASES,
      read<Purchase>(K_PURCHASES).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  },
  removePurchase: (id: string) => {
    write(K_PURCHASES, read<Purchase>(K_PURCHASES).filter((p) => p.id !== id));
  },

  // Casual workers
  listWorkers: (): CasualWorker[] =>
    read<CasualWorker>(K_WORKERS).sort((a, b) => a.name.localeCompare(b.name)),
  addWorker: (data: Omit<CasualWorker, "id" | "createdAt">): CasualWorker => {
    const created: CasualWorker = { ...data, id: uid(), createdAt: new Date().toISOString() };
    write(K_WORKERS, [created, ...read<CasualWorker>(K_WORKERS)]);
    return created;
  },
  removeWorker: (id: string) => {
    write(K_WORKERS, read<CasualWorker>(K_WORKERS).filter((w) => w.id !== id));
  },

  // Casual wages
  listWages: (): CasualWage[] =>
    read<CasualWage>(K_WAGES).sort((a, b) => (a.date < b.date ? 1 : -1)),
  addWage: (data: Omit<CasualWage, "id">): CasualWage => {
    const created: CasualWage = { ...data, id: uid() };
    write(K_WAGES, [created, ...read<CasualWage>(K_WAGES)]);
    return created;
  },
  updateWage: (id: string, patch: Partial<CasualWage>) => {
    write(
      K_WAGES,
      read<CasualWage>(K_WAGES).map((w) => (w.id === id ? { ...w, ...patch } : w)),
    );
  },
  removeWage: (id: string) => {
    write(K_WAGES, read<CasualWage>(K_WAGES).filter((w) => w.id !== id));
  },
};

// Small helper for totals used by the dashboard summary.
export function sumExpensesInRange(from: Date, to: Date): {
  purchases: number;
  wages: number;
  total: number;
} {
  const inRange = (iso: string) => {
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d >= from && d <= to;
  };
  const purchases = expensesStore
    .listPurchases()
    .filter((p) => inRange(p.date))
    .reduce((s, p) => s + (Number(p.total) || 0), 0);
  const wages = expensesStore
    .listWages()
    .filter((w) => inRange(w.date))
    .reduce((s, w) => s + (Number(w.total) || 0), 0);
  return { purchases, wages, total: purchases + wages };
}
