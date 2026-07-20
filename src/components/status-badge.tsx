import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    Paid: "bg-success/15 text-success border-success/30",
    "Partially Paid": "bg-warning/20 text-warning-foreground border-warning/40",
    Unpaid: "bg-muted text-muted-foreground border-border",
    Overdue: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={cn("font-medium", map[status])}>{status}</Badge>;
}

export type StockStatus = "matched" | "pending" | "approved" | "rejected";

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const map: Record<StockStatus, { label: string; className: string }> = {
    matched: { label: "Stock updated", className: "bg-success/15 text-success border-success/20" },
    pending: { label: "Pending approval", className: "bg-warning/15 text-warning-foreground border-warning/30" },
    approved: { label: "Approved", className: "bg-primary/10 text-primary border-primary/20" },
    rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

export type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    pending: "bg-muted text-muted-foreground border-border",
    confirmed: "bg-primary/10 text-primary border-primary/20",
    preparing: "bg-warning/15 text-warning-foreground border-warning/30",
    ready: "bg-warning/20 text-warning-foreground border-warning/40",
    delivered: "bg-success/15 text-success border-success/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={cn("font-medium capitalize", map[status])}>{status}</Badge>;
}

export function PaidBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <Badge variant="outline" className="bg-success/15 text-success border-success/30">Paid</Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Unpaid</Badge>
  );
}
