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
import { formatCurrency } from "@/lib/format";
import { FieldError } from "@/components/field-error";

export const Route = createFileRoute("/sales/new")({
  head: () => ({ meta: [{ title: "New Sale" }] }),
  component: NewSalePage,
});

interface Line { productId: string; qty: number; price?: number; priceText?: string; }

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function NewSalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [storeName, setStoreName] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 1 }]);
  const [invoiceDate, setInvoiceDate] = useState(() => formatInputDate(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return formatInputDate(due);
  });

  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: async () => (await api.listInvoices()).filter((i) => !i.isVoided) });
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId],
  );
  const isCorporate = selectedCustomer?.type === "Corporate";
  const knownStores = useMemo(
    () =>
      Array.from(
        new Set(
          invoices
            .filter((i) => i.customerId === customerId && i.storeName)
            .map((i) => i.storeName as string),
        ),
      ).sort(),
    [invoices, customerId],
  );
  const createSaleMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createSale>[0]) => api.createSale(payload),
    onSuccess: (sale) => {
      toast.success("Sale recorded. Invoice generated.");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (sale.invoiceId) {
        navigate({ to: "/invoices/$id", params: { id: sale.invoiceId } });
      } else {
        navigate({ to: "/transactions" });
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to record sale"),
  });


  const priceOf = (line: Line) => {
    const product = products.find((p) => p.id === line.productId);
    return line.price !== undefined && Number.isFinite(line.price) ? line.price : (product?.unitPrice ?? 0);
  };

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + priceOf(line) * line.qty, 0),
    [lines, products],
  );

  const update = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));

  const priceErrorOf = (line: Line) => {
    if (!line.productId) return undefined;
    if (line.priceText !== undefined && line.priceText.trim() === "") return "Enter a unit price";
    if (line.price !== undefined && (!Number.isFinite(line.price) || line.price <= 0)) {
      return "Price must be greater than 0";
    }
    return undefined;
  };

  const hasInvalidLine = lines.some((line) => {
    const product = products.find((p) => p.id === line.productId);
    return (
      !line.productId ||
      line.qty < 1 ||
      Boolean(priceErrorOf(line)) ||
      (product ? line.qty > product.availableQuantity : false)
    );
  });
  const availableCredit = useMemo(
    () => invoices
      .filter((invoice) => invoice.customerId === customerId && invoice.status === "Credit")
      .reduce((sum, invoice) => sum + invoice.availableCredit, 0),
    [customerId, invoices],
  );
  const creditApplied = Math.min(total, availableCredit);
  const amountToPay = Math.max(total - creditApplied, 0);

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
            storeName: storeName.trim() || undefined,
            paymentType: paymentType as "Cash" | "Credit",
            invoiceDate,
            dueDate,
            items: lines
              .filter((line) => line.productId && line.qty > 0)
              .map((line) => ({
                productId: line.productId,
                quantity: line.qty,
                unitPrice: priceOf(line),
              })),
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
                  const available = product?.availableQuantity ?? 0;
                  const hasStockError = Boolean(product && available <= 0);
                  const overStock = Boolean(product && available > 0 && line.qty > available);
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Select value={line.productId} onValueChange={(value) => update(index, { productId: value, price: undefined })}>
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem
                                key={product.id}
                                value={product.id}
                                disabled={product.availableQuantity <= 0}
                              >
                                {product.name}
                                {product.availableQuantity <= 0 ? " — Out of stock" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={available > 0 ? available : undefined}
                          value={line.qty}
                          onChange={(e) => update(index, { qty: Number(e.target.value) })}
                          className={hasStockError || overStock ? "border-destructive" : ""}
                        />
                        <FieldError
                          message={
                            hasStockError
                              ? "Out of stock"
                              : overStock
                                ? `Only ${available} ${product?.unit ?? "piece"}${available === 1 ? "" : "s"} remaining`
                                : undefined
                          }
                          className="mt-1"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {product ? (
                          <div className="flex flex-col items-end gap-1">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-28 text-right"
                              value={line.price ?? product.unitPrice}
                              onChange={(e) => update(index, { price: e.target.value === "" ? undefined : Number(e.target.value) })}
                            />
                            {priceOf(line) !== product.unitPrice && (
                              <span className="text-xs text-muted-foreground">List: {formatCurrency(product.unitPrice)}</span>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{product ? formatCurrency(priceOf(line) * line.qty) : "—"}</TableCell>
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
            {isCorporate && (
              <div className="grid gap-2">
                <Label htmlFor="store">Store / Branch</Label>
                <Input
                  id="store"
                  list="store-options"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Ruaka"
                />
                <datalist id="store-options">
                  {knownStores.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Shown on the invoice as “{selectedCustomer?.name ?? "Customer"}
                  {storeName.trim() ? ` - ${storeName.trim()}` : ""}”. Statements stay under the corporate account.
                </p>
              </div>
            )}
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
              {creditApplied > 0 && <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Customer credit applied</span><span className="text-success">−{formatCurrency(creditApplied)}</span></div>}
              <div className="mt-3 flex justify-between border-t pt-3"><span className="font-semibold">Total</span><span className="text-lg font-bold text-primary">{formatCurrency(total)}</span></div>
              {creditApplied > 0 && <div className="mt-2 flex justify-between font-medium"><span>{paymentType === "Cash" ? "Amount to pay" : "Balance due"}</span><span>{formatCurrency(amountToPay)}</span></div>}
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
