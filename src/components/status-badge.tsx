import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/mock-data";
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
