import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/mock-data";

export const Route = createFileRoute("/sales/new")({
  head: () => ({ meta: [{ title: "New Sale — Peaceful Acres" }] }),
  component: NewSalePage,
});

interface Line { productId: string; qty: number; }

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function NewSalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 1 }]);
  const [invoiceDate, setInvoiceDate] = useState(() => formatInputDate(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return formatInputDate(due);
  });

  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });
  const createSaleMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createSale>[0]) => api.createSale(payload),
    onSuccess: () => {
      toast.success("Sale recorded. Invoice generated.");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      navigate({ to: "/transactions" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to record sale"),
  });

  const total = useMemo(
    () => lines.reduce((sum, line) => {
      const product = products.find((p) => p.id === line.productId);
      return sum + (product ? product.unitPrice * line.qty : 0);
    }, 0),
    [lines, products],
  );

  const update = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));

  const hasInvalidLine = lines.some((line) => !line.productId || line.qty < 1);

  return (
    <AppShell
      title="New Sale"
      description="Record a sale and auto-generate an invoice."
      actions={<Button variant="outline" asChild><Link to="/transactions"><ArrowLeft className="mr-2 h-4 w-4" />Cancel</Link></Button>}
    >
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customerId || total === 0 || hasInvalidLine || !invoiceDate || !dueDate) return;
          createSaleMutation.mutate({
            customerId,
            paymentType: paymentType as "Cash" | "Credit",
            invoiceDate,
            dueDate,
            items: lines
              .filter((line) => line.productId && line.qty > 0)
              .map((line) => {
                const product = products.find((p) => p.id === line.productId);
                return {
                  productId: line.productId,
                  quantity: line.qty,
                  unitPrice: product?.unitPrice ?? 0,
                };
              }),
          });
        }}
      >
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
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
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Select value={line.productId} onValueChange={(value) => update(index, { productId: value })}>
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={line.qty} onChange={(e) => update(index, { qty: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell className="text-right">{product ? formatCurrency(product.unitPrice) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{product ? formatCurrency(product.unitPrice * line.qty) : "—"}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== index))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Button type="button" variant="outline" className="mt-4" onClick={() => setLines((prev) => [...prev, { productId: "", qty: 1 }])}>
              <Plus className="mr-2 h-4 w-4" />Add Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Date Created</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(total)}</span></div>
              <div className="mt-3 flex justify-between border-t pt-3"><span className="font-semibold">Total</span><span className="text-lg font-bold text-primary">{formatCurrency(total)}</span></div>
            </div>
            <Button type="submit" className="w-full" disabled={!customerId || total === 0 || hasInvalidLine || createSaleMutation.isPending}>
              Record Sale & Generate Invoice
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppShell>
  );
}
