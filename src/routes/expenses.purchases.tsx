import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PaidBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { Plus, ShoppingBag, Truck, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import {
  businessDateSchema,
  normalizePhone,
  optionalEmailSchema,
  optionalPhoneSchema,
  positiveAmountSchema,
  quantitySchema,
  validate,
  hasErrors,
  type FieldErrors,
} from "@/lib/validation";
import { z } from "zod";
import { formatCurrency, formatDate } from "@/lib/format";
import { api } from "@/lib/api";
import { notifyExpensesChanged, type Purchase, type Supplier } from "@/lib/expenses-store";
import { useTableView } from "@/hooks/use-table-view";
import { SortableHead, TablePagination } from "@/components/table-controls";

export const Route = createFileRoute("/expenses/purchases")({
  head: () => ({ meta: [{ title: "Purchases" }] }),
  component: PurchasesPage,
});

const PURCHASE_CATEGORIES = [
  "Feed", "Veterinary", "Equipment", "Supplies", "Utilities",
  "Transport", "Repairs & Maintenance", "Other",
];
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "M-Pesa", "Credit", "Cheque"];

function PurchasesPage() {
  const qc = useQueryClient();

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => api.listPurchases(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.listSuppliers(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    notifyExpensesChanged();
  };

  const deletePurchase = useMutation({
    mutationFn: (id: string) => api.deletePurchase(id),
    onSuccess: () => { toast.success("Purchase deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const setPaid = useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) => api.setPurchasePaid(id, paid),
    onSuccess: (p) => { toast.success(p.paid ? "Marked as paid" : "Marked as unpaid"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update payment status"),
  });

  const deleteSupplier = useMutation({
    mutationFn: (id: string) => api.deleteSupplier(id),
    onSuccess: () => { toast.success("Supplier removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const monthTotal = useMemo(() => {
    const now = new Date();
    return purchases
      .filter((p) => {
        const d = new Date(p.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, p) => s + p.total, 0);
  }, [purchases]);

  const yearTotal = useMemo(
    () =>
      purchases
        .filter((p) => new Date(p.date).getFullYear() === new Date().getFullYear())
        .reduce((s, p) => s + p.total, 0),
    [purchases],
  );

  const totals = useMemo(() => {
    let total = 0, paid = 0, owing = 0, paidCount = 0, owingCount = 0;
    for (const p of purchases) {
      const amt = Number(p.total) || 0;
      total += amt;
      if (p.paid) { paid += amt; paidCount++; } else { owing += amt; owingCount++; }
    }
    return { total, paid, owing, paidCount, owingCount };
  }, [purchases]);


  const purchasesView = useTableView({
    data: purchases,
    accessors: {
      date: (p: Purchase) => p.date,
      supplierName: (p: Purchase) => p.supplierName || "",
      category: (p: Purchase) => p.category,
      item: (p: Purchase) => p.item,
      quantity: (p: Purchase) => Number(p.quantity),
      unitCost: (p: Purchase) => Number(p.unitCost),
      total: (p: Purchase) => Number(p.total),
      paid: (p: Purchase) => (p.paid ? 1 : 0),
    },
    defaultSort: { key: "date", dir: "desc" },
  });

  const supplierOutstanding = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of purchases) {
      if (p.paid || !p.supplierId) continue;
      m.set(p.supplierId, (m.get(p.supplierId) ?? 0) + Number(p.total || 0));
    }
    return m;
  }, [purchases]);

  const suppliersView = useTableView({
    data: suppliers,
    accessors: {
      name: (s: Supplier) => s.name,
      contact: (s: Supplier) => s.contactPerson || "",
      phone: (s: Supplier) => s.phone || "",
      email: (s: Supplier) => s.email || "",
    },
    defaultSort: { key: "name", dir: "asc" },
  });

  return (
    <AppShell
      title="Purchases"
      actions={
        <div className="flex gap-2">
          <NewSupplierDialog onCreated={invalidate} />
          <NewPurchaseDialog suppliers={suppliers} onCreated={invalidate} />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="This month"
          value={formatCurrency(monthTotal)}
          icon={Receipt}
          tone="warning"
          trend={`${purchases.filter((p) => {
            const d = new Date(p.date);
            const n = new Date();
            return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
          }).length} entries`}
        />
        <StatCard label="Year to date" value={formatCurrency(yearTotal)} icon={ShoppingBag} tone="earth" />
        <StatCard
          label="Suppliers"
          value={String(suppliers.length)}
          icon={Truck}
          tone="primary"
          trend="Active suppliers on file"
        />
      </div>

      <Tabs defaultValue="purchases" className="mt-6">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardHeader><CardTitle>All purchases</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead ctrl={purchasesView} sortKey="date">Date</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="supplierName">Supplier</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="category">Category</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="item">Item</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="quantity" align="right">Qty</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="unitCost" align="right">Unit cost</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="total" align="right">Total</SortableHead>
                    <SortableHead ctrl={purchasesView} sortKey="paid">Payment</SortableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesView.paged.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell className="font-medium">{p.supplierName || "—"}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>
                        <div>{p.item}</div>
                        {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                      </TableCell>
                      <TableCell className="text-right">{p.quantity} {p.unit ?? ""}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.unitCost)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(p.total)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={p.paid}
                            disabled={setPaid.isPending}
                            aria-label={p.paid ? "Mark as unpaid" : "Mark as paid"}
                            onCheckedChange={(v) => setPaid.mutate({ id: p.id, paid: v })}
                          />
                          <PaidBadge paid={p.paid} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm("Delete this purchase?")) deletePurchase.mutate(p.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {purchasesView.total === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        No purchases recorded yet. Click “Record purchase” to add one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination ctrl={purchasesView} label="purchases" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Suppliers</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead ctrl={suppliersView} sortKey="name">Name</SortableHead>
                    <SortableHead ctrl={suppliersView} sortKey="contact">Contact</SortableHead>
                    <SortableHead ctrl={suppliersView} sortKey="phone">Phone</SortableHead>
                    <SortableHead ctrl={suppliersView} sortKey="email">Email</SortableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersView.paged.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.contactPerson ?? "—"}</TableCell>
                      <TableCell>{s.phone ?? "—"}</TableCell>
                      <TableCell>{s.email ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {supplierOutstanding.get(s.id) ? (
                          <span className="font-semibold text-destructive">
                            {formatCurrency(supplierOutstanding.get(s.id)!)}
                          </span>
                        ) : (
                          <PaidBadge paid />
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{s.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm(`Remove ${s.name}?`)) deleteSupplier.mutate(s.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliersView.total === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No suppliers yet. Add one with “New supplier”.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination ctrl={suppliersView} label="suppliers" />
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function NewSupplierDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const reset = () => { setName(""); setContact(""); setPhone(""); setEmail(""); setNotes(""); setErrors({}); };

  const createSupplier = useMutation({
    mutationFn: (payload: Parameters<typeof api.createSupplier>[0]) => api.createSupplier(payload),
    onSuccess: () => {
      toast.success("Supplier added");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save supplier"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New supplier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New supplier</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" />
          </div>
          <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
            <div className="grid gap-1.5">
              <Label>Contact person</Label>
              <Input value={contactPerson} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} />
              <FieldError message={errors.phone} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" aria-invalid={!!errors.email} />
            <FieldError message={errors.email} />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={createSupplier.isPending}
            onClick={() => {
              const found = validate(
                z.object({ phone: optionalPhoneSchema, email: optionalEmailSchema }),
                { phone, email },
              );
              setErrors(found);
              if (!name.trim()) return toast.error("Name is required");
              if (hasErrors(found)) return;
              createSupplier.mutate({
                name: name.trim(),
                contactPerson: contactPerson.trim() || undefined,
                phone: normalizePhone(phone) ?? undefined,
                email: email.trim() || undefined,
                notes: notes.trim() || undefined,
              });
            }}
          >
            Save supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPurchaseDialog({
  suppliers, onCreated,
}: {
  suppliers: Supplier[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierNameFallback, setSupplierNameFallback] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>(PURCHASE_CATEGORIES[0]);
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState<string>("1");
  const [unit, setUnit] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");

  const [purchaseErrors, setPurchaseErrors] = useState<FieldErrors>({});
  const qty = Number(quantity) || 0;
  const cost = Number(unitCost) || 0;
  const total = qty * cost;

  const reset = () => {
    setSupplierId(""); setSupplierNameFallback("");
    setDate(new Date().toISOString().slice(0, 10));
    setCategory(PURCHASE_CATEGORIES[0]);
    setItem(""); setQuantity("1"); setUnit(""); setUnitCost("");
    setPaymentMethod(PAYMENT_METHODS[0]); setNotes("");
  };

  const createPurchase = useMutation({
    mutationFn: (payload: Parameters<typeof api.createPurchase>[0]) => api.createPurchase(payload),
    onSuccess: () => {
      toast.success("Purchase recorded");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save purchase"),
  });

  const submit = () => {
    const found = validate(
      z.object({ date: businessDateSchema, quantity: quantitySchema, unitCost: positiveAmountSchema }),
      { date, quantity: qty, unitCost: cost },
    );
    setPurchaseErrors(found);
    if (!item.trim()) return toast.error("Item description is required");
    if (hasErrors(found)) return;
    const supplier = suppliers.find((s) => s.id === supplierId);
    const supplierName = supplier?.name ?? supplierNameFallback.trim();
    if (!supplierName) return toast.error("Choose a supplier or enter a name");

    createPurchase.mutate({
      supplierId: supplier?.id,
      supplierName,
      date,
      category,
      item: item.trim(),
      quantity: qty,
      unit: unit.trim() || undefined,
      unitCost: cost,
      paymentMethod,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Record purchase</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Record purchase</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              {suppliers.length > 0 ? (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={supplierNameFallback} onChange={(e) => setSupplierNameFallback(e.target.value)} placeholder="Supplier name" />
              )}
              {suppliers.length > 0 && !supplierId && (
                <Input
                  className="mt-2"
                  value={supplierNameFallback}
                  onChange={(e) => setSupplierNameFallback(e.target.value)}
                  placeholder="…or type a one-off supplier"
                />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!purchaseErrors.date} />
              <FieldError message={purchaseErrors.date} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURCHASE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Item *</Label>
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Layers Mash 50kg bag" />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Quantity</Label>
              <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-invalid={!!purchaseErrors.quantity} />
              <FieldError message={purchaseErrors.quantity} />
            </div>
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bag, kg, litre…" />
            </div>
            <div className="grid gap-1.5">
              <Label>Unit cost</Label>
              <Input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} aria-invalid={!!purchaseErrors.unitCost} />
              <FieldError message={purchaseErrors.unitCost} />
            </div>
            <div className="grid gap-1.5">
              <Label>Total</Label>
              <Input readOnly value={formatCurrency(total)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createPurchase.isPending}>Save purchase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
