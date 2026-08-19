import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export type NotificationSeverity = "info" | "warning" | "danger";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  to: string;
  severity: NotificationSeverity;
  at?: string;
}

const READ_KEY = "paf.notifications.read";

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function buildNotifications(data: {
  invoices: Awaited<ReturnType<typeof api.listInvoices>>;
  products: Awaited<ReturnType<typeof api.listProducts>>;
  stock: Awaited<ReturnType<typeof api.listStockEntries>>;
  purchases: Awaited<ReturnType<typeof api.listPurchases>>;
  orders: Awaited<ReturnType<typeof api.listOrders>>;
}): AppNotification[] {
  const now = new Date();
  const out: AppNotification[] = [];

  // Overdue receivables
  const overdue = data.invoices.filter(
    (i) => !i.isVoided && i.outstandingBalance > 0 && i.dueDate && new Date(i.dueDate) < now,
  );
  if (overdue.length) {
    const total = overdue.reduce((s, i) => s + i.outstandingBalance, 0);
    const oldest = overdue.reduce((a, b) => (new Date(a.dueDate) < new Date(b.dueDate) ? a : b));
    out.push({
      id: `overdue:${overdue.length}:${Math.round(total)}`,
      title: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""}`,
      message: `${formatCurrency(total)} past due — oldest ${daysBetween(now, new Date(oldest.dueDate))} days.`,
      to: "/receivables",
      severity: "danger",
    });
  }

  // Invoices due in the next 7 days
  const dueSoon = data.invoices.filter((i) => {
    if (i.isVoided || i.outstandingBalance <= 0 || !i.dueDate) return false;
    const d = new Date(i.dueDate);
    return d >= now && daysBetween(d, now) <= 7;
  });
  if (dueSoon.length) {
    out.push({
      id: `duesoon:${dueSoon.length}`,
      title: `${dueSoon.length} invoice${dueSoon.length > 1 ? "s" : ""} due this week`,
      message: `${formatCurrency(dueSoon.reduce((s, i) => s + i.outstandingBalance, 0))} expected within 7 days.`,
      to: "/invoices",
      severity: "info",
    });
  }

  // Pending orders
  const pending = data.orders.filter((o) => o.status === "pending");
  if (pending.length) {
    out.push({
      id: `orders:${pending.length}`,
      title: `${pending.length} pending order${pending.length > 1 ? "s" : ""}`,
      message: "Waiting for staff confirmation.",
      to: "/orders",
      severity: "warning",
    });
  }

  // Stock entries awaiting approval
  const pendingStock = data.stock.filter((s) => s.status === "pending");
  if (pendingStock.length) {
    out.push({
      id: `stock:${pendingStock.length}`,
      title: `${pendingStock.length} stock entr${pendingStock.length > 1 ? "ies" : "y"} to approve`,
      message: "Recorded produce not yet added to inventory.",
      to: "/stock",
      severity: "warning",
    });
  }

  // Out of / low stock
  const out0 = data.products.filter((p) => p.availableQuantity <= 0);
  const low = data.products.filter((p) => p.availableQuantity > 0 && p.availableQuantity < 10);
  if (out0.length) {
    out.push({
      id: `outofstock:${out0.length}`,
      title: `${out0.length} product${out0.length > 1 ? "s" : ""} out of stock`,
      message: out0.slice(0, 3).map((p) => p.name).join(", ") + (out0.length > 3 ? "…" : ""),
      to: "/products",
      severity: "danger",
    });
  }
  if (low.length) {
    out.push({
      id: `lowstock:${low.length}`,
      title: `${low.length} product${low.length > 1 ? "s" : ""} running low`,
      message: low.slice(0, 3).map((p) => `${p.name} (${p.availableQuantity} ${p.unit})`).join(", "),
      to: "/products",
      severity: "warning",
    });
  }

  // Unpaid supplier purchases
  const unpaid = data.purchases.filter((p) => !p.paid);
  if (unpaid.length) {
    out.push({
      id: `purchases:${unpaid.length}`,
      title: `${unpaid.length} unpaid purchase${unpaid.length > 1 ? "s" : ""}`,
      message: `${formatCurrency(unpaid.reduce((s, p) => s + p.total, 0))} owed to suppliers.`,
      to: "/expenses/purchases",
      severity: "info",
    });
  }

  return out;
}

export function useNotifications() {
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => api.listInvoices() });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api.listProducts() });
  const stock = useQuery({ queryKey: ["stock-entries"], queryFn: () => api.listStockEntries() });
  const purchases = useQuery({ queryKey: ["purchases"], queryFn: () => api.listPurchases() });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api.listOrders() });

  const notifications = useMemo(
    () =>
      buildNotifications({
        invoices: invoices.data ?? [],
        products: products.data ?? [],
        stock: stock.data ?? [],
        purchases: purchases.data ?? [],
        orders: orders.data ?? [],
      }),
    [invoices.data, products.data, stock.data, purchases.data, orders.data],
  );

  // Read/dismissed state is persisted per user on the server so the bell
  // behaves the same on every device; localStorage is only an offline cache.
  const queryClient = useQueryClient();
  const state = useQuery({
    queryKey: ["notification-state"],
    queryFn: () => api.getNotificationState(),
    staleTime: 30_000,
  });

  const [local, setLocal] = useState<{ read: string[]; dismissed: string[] }>({
    read: [],
    dismissed: [],
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(READ_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLocal({ read: parsed as string[], dismissed: [] });
        else if (parsed && typeof parsed === "object")
          setLocal({ read: parsed.read ?? [], dismissed: parsed.dismissed ?? [] });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistLocal = useCallback((next: { read: string[]; dismissed: string[] }) => {
    setLocal(next);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (state.data) persistLocal(state.data);
  }, [state.data, persistLocal]);

  const readIds = state.data?.read ?? local.read;
  const dismissedIds = state.data?.dismissed ?? local.dismissed;

  const push = useCallback(
    async (keys: string[], mode: "read" | "dismiss") => {
      if (keys.length === 0) return;
      const next = {
        read: Array.from(new Set([...readIds, ...keys])),
        dismissed:
          mode === "dismiss" ? Array.from(new Set([...dismissedIds, ...keys])) : dismissedIds,
      };
      persistLocal(next);
      queryClient.setQueryData(["notification-state"], next);
      try {
        const server =
          mode === "dismiss"
            ? await api.dismissNotifications(keys)
            : await api.markNotificationsRead(keys);
        queryClient.setQueryData(["notification-state"], server);
        persistLocal(server);
      } catch {
        /* stay with the optimistic local state */
      }
    },
    [readIds, dismissedIds, persistLocal, queryClient],
  );

  const visible = useMemo(
    () => notifications.filter((n) => !dismissedIds.includes(n.id)),
    [notifications, dismissedIds],
  );
  const unread = visible.filter((n) => !readIds.includes(n.id));

  const markAllRead = useCallback(
    () => void push(visible.map((n) => n.id), "read"),
    [visible, push],
  );
  const markRead = useCallback((id: string) => void push([id], "read"), [push]);
  const dismiss = useCallback((id: string) => void push([id], "dismiss"), [push]);
  const dismissAll = useCallback(
    () => void push(visible.map((n) => n.id), "dismiss"),
    [visible, push],
  );

  return {
    notifications: visible,
    unreadCount: unread.length,
    isRead: (id: string) => readIds.includes(id),
    markAllRead,
    markRead,
    dismiss,
    dismissAll,
    isLoading: invoices.isLoading || products.isLoading || orders.isLoading,
  };
}
