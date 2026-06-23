import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { canEditSales } from "@/lib/permissions";

export const Route = createFileRoute("/sales/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Sale — Peaceful Acres" }] }),
  component: EditSalePage,
});

interface Line {
  productId: string;
  qty: number;
  unitPrice: number;
}

function formatInputDate(value: string | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function EditSalePage() {
  const { id } = useParams({ from: "/sales/$id/edit" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const mayEdit = canEditSales(user);

  const saleQuery = useQuery({
    queryKey: ["sale", id],
    queryFn: () => api.getSale(id),
    enabled: mayEdit,
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });

  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Cash");
  const [lines, setLines] = useState<Line[]>([]);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Hydrate form once sale loads.
  useEffect(() => {
    const sale = saleQuery.data;
    if (!sale) return;
    setCustomerId(sale.customerId);
    setPaymentType(sale.paymentType === "Credit" ? "Credit" : "Cash");
    setInvoiceDate(formatInputDate(sale.date));
    setLines(
      sale.items.map((item) => ({
        productId: item.productId,
        qty: item.quantity,
        unitPrice: item.unitPrice,
      })),
    );
  }, [saleQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.updateSale>[1]) => api.updateSale(id, payload),
    onSuccess: () => {
      toast.success("Sale updated. Invoice and balances recalculated.");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      navigate({ to: "/transactions" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to update sale"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSale(id),
    onSuccess: () => {
      toast.success("Sale deleted.");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate({ to: "/transactions" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to delete sale"),
  });

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.productId);
        const price = line.unitPrice || product?.unitPrice || 0;
        return sum + price * line.qty;
      }, 0),
    [lines, products],
  );

  const update = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));

  const hasInvalidLine = lines.some((line) => !line.productId || line.qty < 1);

  if (authLoading) {
    return (
      <AppShell title="Edit Sale" description="Loading…">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking permissions…
        </div>
      </AppShell>
    );
  }

  if (!mayEdit) {
    return (
      <AppShell title="Edit Sale" description="Restricted action">
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <span className="font-medium">You don't have permission to edit sales.</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Editing sales is restricted to admins and staff with the appropriate permission. Ask an
              administrator to grant you access.
            </p>
            <Button variant="outline" asChild>
              <Link to="/transactions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to transactions
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (saleQuery.isLoading) {
    return (
      <AppShell title="Edit Sale" description="Loading sale…">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (saleQuery.isError || !saleQuery.data) {
    return (
      <AppShell title="Edit Sale" description="Sale not found">
        <p className="text-sm text-destructive">
          {saleQuery.error instanceof Error ? saleQuery.error.message : "Sale could not be loaded."}
        </p>
      </AppShell>
    );
  }

  const sale = saleQuery.data;

  return (
    <AppShell
      title={`Edit Sale ${sale.invoiceNumber ? `· ${sale.invoiceNumber}` : ""}`}
      description="Changes recalculate the invoice total, outstanding balance, and customer balance."
      actions={
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the sale and its invoice. Any related payments will be unlinked. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" asChild>
            <Link to="/transactions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
        </div>
      }
    >
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customerId || total === 0 || hasInvalidLine) return;
          updateMutation.mutate({
            customerId,
            paymentType,
            invoiceDate,
            dueDate: dueDate || undefined,
            items: lines
              .filter((line) => line.productId && line.qty > 0)
              .map((line) => {
                const product = products.find((p) => p.id === line.productId);
                return {
                  productId: line.productId,
                  quantity: line.qty,
                  unitPrice: line.unitPrice || product?.unitPrice || 0,
                };
              }),
          });
        }}
      >
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => {
                  const product = products.find((p) => p.id === line.productId);
                  const price = line.unitPrice || product?.unitPrice || 0;
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.productId}
                          onValueChange={(value) => {
                            const p = products.find((pr) => pr.id === value);
                            update(index, { productId: value, unitPrice: p?.unitPrice ?? 0 });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) => update(index, { qty: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={price}
                          onChange={(e) => update(index, { unitPrice: Number(e.target.value) })}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(price * line.qty)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setLines((prev) => prev.filter((_, idx) => idx !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setLines((prev) => [...prev, { productId: "", qty: 1, unitPrice: 0 }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sale Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as "Cash" | "Credit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!customerId || total === 0 || hasInvalidLine || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppShell>
  );
}
