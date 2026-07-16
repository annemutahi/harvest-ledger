// Orders are backed by the Django REST API. This module re-exports types and
// small async helpers used by the dashboard.

import { api, type ApiOrder, type ApiOrderStatus, type ApiOrderChannel, type ApiOrderItem } from "./api";

export type OrderStatus = ApiOrderStatus;
export type OrderChannel = ApiOrderChannel;
export type OrderItem = ApiOrderItem;
export type Order = ApiOrder;

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

export const ORDERS_CHANGE_EVENT = "peaceful-acres-orders-changed";

export function notifyOrdersChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ORDERS_CHANGE_EVENT));
  }
}

/**
 * Sum delivered-order totals whose placed_at falls in [from, to].
 * Used by the dashboard so delivered orders count towards monthly sales.
 */
export async function fetchDeliveredOrdersInRange(from: Date, to: Date): Promise<number> {
  try {
    const orders = await api.listOrders();
    return orders
      .filter((o) => o.status === "delivered")
      .filter((o) => {
        const d = new Date(o.updatedAt || o.placedAt);
        return !Number.isNaN(d.getTime()) && d >= from && d <= to;
      })
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
  } catch {
    return 0;
  }
}
