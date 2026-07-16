// Expenses are now backed by the Django REST API (src/lib/api).
// This file keeps the type names used across the app and provides
// small async helpers for dashboard aggregates.

import { api, type ApiSupplier, type ApiPurchase, type ApiCasualWorker, type ApiCasualWage } from "./api";

export type Supplier = ApiSupplier;
export type Purchase = ApiPurchase;
export type CasualWorker = ApiCasualWorker;
export type CasualWage = ApiCasualWage;

// Retained for backwards compatibility with any component still listening.
// The Expenses screens now use react-query, so this event is dispatched by
// mutations that want to nudge non-query subscribers (dashboard tile) to
// refetch.
export const EXPENSES_CHANGE_EVENT = "peaceful-acres-expenses-changed";

export function notifyExpensesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
  }
}

/**
 * Fetch purchases + wages and sum the totals falling within [from, to].
 * Used by the dashboard tile. Returns zeros on failure so the tile keeps
 * rendering.
 */
export async function fetchExpensesInRange(from: Date, to: Date): Promise<{
  purchases: number;
  wages: number;
  total: number;
}> {
  const inRange = (iso: string) => {
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d >= from && d <= to;
  };
  try {
    const [purchases, wages] = await Promise.all([
      api.listPurchases(),
      api.listCasualWages(),
    ]);
    const p = purchases.filter((x) => inRange(x.date)).reduce((s, x) => s + (Number(x.total) || 0), 0);
    const w = wages.filter((x) => inRange(x.date)).reduce((s, x) => s + (Number(x.total) || 0), 0);
    return { purchases: p, wages: w, total: p + w };
  } catch {
    return { purchases: 0, wages: 0, total: 0 };
  }
}
