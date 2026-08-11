import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ORDER_STATUSES, notifyOrdersChanged, type OrderStatus } from "@/lib/orders-store";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Order" }] }),
  component: OrderDetailPage,
  notFoundComponent: OrderNotFound,
});

function OrderNotFound() {
  return (
    <AppShell title="Order not found">
      <p className="text-muted-foreground">
        This order no longer exists.{" "}
        <Link to="/orders" className="underline">Back to orders</Link>
      </p>
    </AppShell>
  );
}

function OrderDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.getOrder(id),
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => api.updateOrderStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData(["orders", id], updated);
      qc.invalidateQueries({ queryKey: ["orders"] });
      notifyOrdersChanged();
      toast.success(`Marked as ${updated.status}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  if (isLoading) {
    return (
      <AppShell title="Loading…">
        <p className="text-muted-foreground">Fetching order…</p>
      </AppShell>
    );
  }
  if (isError || !order) throw notFound();

  return (
    <AppShell
      title={order.reference}
      description={`Placed ${formatDate(order.placedAt)} • ${order.channel}`}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/orders/$id/document" params={{ id }} search={{ format: "invoice" }}>
              <FileText className="mr-2 h-4 w-4" />
              Invoice
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/orders/$id/document" params={{ id }} search={{ format: "receipt" }}>
              <ReceiptText className="mr-2 h-4 w-4" />
              Receipt
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{i.productName}</TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold">{formatCurrency(order.total)}</span>
            </div>
            {order.notes && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium">Notes: </span>{order.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="outline" className="capitalize">{order.status}</Badge>
              <Select
                value={order.status}
                onValueChange={(v) => statusMutation.mutate(v as OrderStatus)}
                disabled={statusMutation.isPending}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Marking an order as <b>delivered</b> adds its total to monthly sales.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Name: </span>{order.customerName}</div>
              {order.customerPhone && <div><span className="text-muted-foreground">Phone: </span>{order.customerPhone}</div>}
              {order.customerEmail && <div><span className="text-muted-foreground">Email: </span>{order.customerEmail}</div>}
              {order.deliveryAddress && (
                <div><span className="text-muted-foreground">Address: </span>{order.deliveryAddress}</div>
              )}
              {order.storeSource && (
                <div><span className="text-muted-foreground">Source: </span>{order.storeSource}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
