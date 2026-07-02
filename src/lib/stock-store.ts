// Local store for daily stock entries recorded by farmhands.
// Kept in localStorage until a backend `/api/stock/` endpoint is available.
// TODO(backend): replace with real API calls (GET/POST /api/stock/, PATCH /api/stock/:id/approve).

export type StockEntryStatus = "matched" | "pending" | "approved" | "rejected";

export type StockEntry = {
  id: string;
  productName: string;
  category: string;
  quantity: number;
  unit?: string;
  notes?: string;
  recordedBy: string;
  recordedAt: string; // ISO
  status: StockEntryStatus;
  matchedProductId?: string; // set when auto-matched to an existing product
};

const KEY = "peaceful_acres_stock_entries";

function read(): StockEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StockEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: StockEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("peaceful-acres-stock-changed"));
}

export const stockStore = {
  list: (): StockEntry[] =>
    read().sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)),
  add: (entry: Omit<StockEntry, "id" | "recordedAt">): StockEntry => {
    const created: StockEntry = {
      ...entry,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: new Date().toISOString(),
    };
    write([created, ...read()]);
    return created;
  },
  update: (id: string, patch: Partial<StockEntry>) => {
    write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  },
  remove: (id: string) => {
    write(read().filter((e) => e.id !== id));
  },
};
