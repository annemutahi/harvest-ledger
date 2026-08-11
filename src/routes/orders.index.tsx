import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { OrderStatus } from "@/lib/orders-store";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTableView } from "@/hooks/use-table-view";
import { SortableHead, TablePagination } from "@/components/table-controls";


export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders" }] }),
  component: OrdersPage,
});

const statusVariant: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function OrdersPage() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => api.listOrders() });
  const [q, setQ] = useState("");
  const query = q.toLowerCase();
  const filtered = orders.filter(
    (o) =>
      !query ||
      o.reference.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.status.includes(query),
  );

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const view = useTableView({
    data: filtered,
    accessors: {
      reference: (o) => o.reference,
      placedAt: (o) => o.placedAt,
      customerName: (o) => o.customerName,
      channel: (o) => o.channel,
      total: (o) => Number(o.total),
      status: (o) => o.status,
    },
    defaultSort: { key: "placedAt", dir: "desc" },
  });


  return (
    <AppShell
      title="Orders"
      description={`${orders.length} total • ${pendingCount} pending`}
      actions={
        <Button asChild>
          <Link to="/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New In-person Order
          </Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference, customer, or status"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead ctrl={view} sortKey="reference">Reference</SortableHead>
                  <SortableHead ctrl={view} sortKey="placedAt">Placed</SortableHead>
                  <SortableHead ctrl={view} sortKey="customerName">Customer</SortableHead>
                  <SortableHead ctrl={view} sortKey="channel">Channel</SortableHead>
                  <SortableHead ctrl={view} sortKey="total" align="right">Total</SortableHead>
                  <SortableHead ctrl={view} sortKey="status">Status</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.total === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No orders yet. Online orders will appear here automatically.
                    </TableCell>
                  </TableRow>
                )}
                {view.paged.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link to="/orders/$id" params={{ id: o.id }} className="hover:underline">
                        {o.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(o.placedAt)}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.channel}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(o.total)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusVariant[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination ctrl={view} label="orders" />
        </CardContent>
      </Card>
    </AppShell>
  );

}
