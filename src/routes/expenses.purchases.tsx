import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { StatCard } from "@/components/stat-card";
import { Plus, ShoppingBag, Truck, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { expensesStore, type Purchase, type Supplier } from "@/lib/expenses-store";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/expenses/purchases")({
  head: () => ({ meta: [{ title: "Purchases — Peaceful Acres" }] }),
  component: PurchasesPage,
});

const PURCHASE_CATEGORIES = [
  "Feed",
  "Veterinary",
  "Equipment",
  "Supplies",
  "Utilities",
  "Transport",
  "Repairs & Maintenance",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "M-Pesa", "Credit", "Cheque"];

function useLocalState<T>(compute: () => T, deps: unknown[]): [T, () => void] {
  const [, tick] = useState(0);
  const value = useMemo(compute, [tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, () => tick((n) => n + 1)];
}

function PurchasesPage() {
  const { user } = useAuth();
  const [purchases, refreshPurchases] = useLocalState(() => expensesStore.listPurchases(), []);
  const [suppliers, refreshSuppliers] = useLocalState(() => expensesStore.listSuppliers(), []);

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

  return (
    <AppShell
      title="Purchases"
      description="Track supplier purchases and running expenses."
      actions={
        <div className="flex gap-2">
          <NewSupplierDialog onCreated={refreshSuppliers} />
          <NewPurchaseDialog
            suppliers={suppliers}
            onCreated={refreshPurchases}
            recordedBy={user?.username}
          />
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
        <StatCard
          label="Year to date"
          value={formatCurrency(yearTotal)}
          icon={ShoppingBag}
          tone="earth"
        />
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
            <CardHeader>
              <CardTitle>All purchases</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell className="font-medium">{p.supplierName || "—"}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>
                        <div>{p.item}</div>
                        {p.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.quantity} {p.unit ?? ""}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(p.unitCost)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(p.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Delete this purchase?")) {
                              expensesStore.removePurchase(p.id);
                              refreshPurchases();
                              toast.success("Purchase deleted");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {purchases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No purchases recorded yet. Click “Record purchase” to add one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.contactPerson ?? "—"}</TableCell>
                      <TableCell>{s.phone ?? "—"}</TableCell>
                      <TableCell>{s.email ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{s.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove ${s.name}?`)) {
                              expensesStore.removeSupplier(s.id);
                              refreshSuppliers();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No suppliers yet. Add one with “New supplier”.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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

  const reset = () => {
    setName(""); setContact(""); setPhone(""); setEmail(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New supplier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New supplier</DialogTitle>
        </DialogHeader>
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
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!name.trim()) return toast.error("Name is required");
              expensesStore.addSupplier({
                name: name.trim(),
                contactPerson: contactPerson.trim() || undefined,
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                notes: notes.trim() || undefined,
              });
              toast.success("Supplier added");
              onCreated();
              setOpen(false);
              reset();
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
  suppliers,
  onCreated,
  recordedBy,
}: {
  suppliers: Supplier[];
  onCreated: () => void;
  recordedBy?: string;
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

  const submit = () => {
    if (!item.trim()) return toast.error("Item description is required");
    if (qty <= 0) return toast.error("Quantity must be greater than 0");
    if (cost <= 0) return toast.error("Unit cost must be greater than 0");

    const supplier = suppliers.find((s) => s.id === supplierId);
    const supplierName = supplier?.name ?? supplierNameFallback.trim();
    if (!supplierName) return toast.error("Choose a supplier or enter a name");

    const payload: Omit<Purchase, "id"> = {
      supplierId: supplier?.id,
      supplierName,
      date,
      category,
      item: item.trim(),
      quantity: qty,
      unit: unit.trim() || undefined,
      unitCost: cost,
      total,
      paymentMethod,
      notes: notes.trim() || undefined,
      recordedBy,
    };
    expensesStore.addPurchase(payload);
    toast.success("Purchase recorded");
    onCreated();
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Record purchase</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record purchase</DialogTitle>
        </DialogHeader>
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
                <Input
                  value={supplierNameFallback}
                  onChange={(e) => setSupplierNameFallback(e.target.value)}
                  placeholder="Supplier name"
                />
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
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURCHASE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
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
              <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bag, kg, litre…" />
            </div>
            <div className="grid gap-1.5">
              <Label>Unit cost</Label>
              <Input type="number" min="0" step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
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
          <Button onClick={submit}>Save purchase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
