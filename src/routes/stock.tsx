import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Check, X, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { stockStore, type StockEntry } from "@/lib/stock-store";
import { useAuth } from "@/lib/auth-context";
import { canManageProducts } from "@/lib/permissions";
import { formatCurrency, type Product } from "@/lib/mock-data";

export const Route = createFileRoute("/stock")({
  head: () => ({ meta: [{ title: "Stock — Peaceful Acres" }] }),
  component: StockPage,
});

function findMatch(products: Product[], name: string): Product | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return products.find((p) => p.name.trim().toLowerCase() === n);
}

function StockPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = canManageProducts(user);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: api.listProducts,
  });

  const [entries, setEntries] = useState<StockEntry[]>([]);
  useEffect(() => {
    const sync = () => setEntries(stockStore.list());
    sync();
    window.addEventListener("peaceful-acres-stock-changed", sync);
    return () => window.removeEventListener("peaceful-acres-stock-changed", sync);
  }, []);

  // Record dialog
  const [openRecord, setOpenRecord] = useState(false);
  const [form, setForm] = useState({ productName: "", category: "", quantity: 0, notes: "" });
  const suggestion = useMemo(() => findMatch(products, form.productName), [products, form.productName]);

  const incrementStock = useMutation({
    mutationFn: ({ product, qty }: { product: Product; qty: number }) =>
      api.updateProduct(product.id, {
        availableQuantity: (product.availableQuantity ?? 0) + qty,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    const name = form.productName.trim();
    if (!name || form.quantity <= 0) {
      toast.error("Enter a product name and quantity greater than zero.");
      return;
    }
    const match = findMatch(products, name);
    try {
      if (match) {
        await incrementStock.mutateAsync({ product: match, qty: form.quantity });
        stockStore.add({
          productName: match.name,
          category: match.category,
          quantity: form.quantity,
          unit: match.unit,
          notes: form.notes || undefined,
          recordedBy: user?.username ?? "farmhand",
          status: "matched",
          matchedProductId: match.id,
        });
        toast.success(`Added ${form.quantity} ${match.unit ?? "units"} to ${match.name}`);
      } else {
        stockStore.add({
          productName: name,
          category: form.category.trim() || "Uncategorized",
          quantity: form.quantity,
          notes: form.notes || undefined,
          recordedBy: user?.username ?? "farmhand",
          status: "pending",
        });
        toast.success("Recorded. Manager will review and add to products.");
      }
      setForm({ productName: "", category: "", quantity: 0, notes: "" });
      setOpenRecord(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record stock");
    }
  }

  // Approve (manager only): create product with price, mark entry approved
  const [approving, setApproving] = useState<StockEntry | null>(null);
  const [priceForm, setPriceForm] = useState({ unitPrice: 0, unit: "piece" });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approving) throw new Error("No entry selected");
      const created = await api.createProduct({
        name: approving.productName,
        category: approving.category,
        unitPrice: priceForm.unitPrice,
        availableQuantity: approving.quantity,
      });
      stockStore.update(approving.id, { status: "approved", matchedProductId: created.id });
      return created;
    },
    onSuccess: () => {
      toast.success("Product added to catalogue.");
      qc.invalidateQueries({ queryKey: ["products"] });
      setApproving(null);
      setPriceForm({ unitPrice: 0, unit: "piece" });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to create product"),
  });

  return (
    <AppShell title="Stock" description="Record daily produce from the farm.">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Daily produce entries</p>
            <p className="text-xs text-muted-foreground">
              Matching products auto-increase in stock. New items wait for manager approval.
            </p>
          </div>
          <Dialog open={openRecord} onOpenChange={setOpenRecord}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Record Produce</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Produce</DialogTitle></DialogHeader>
              <form className="grid gap-4" onSubmit={handleRecord}>
                <div className="grid gap-2">
                  <Label>Product Name</Label>
                  <Input
                    required
                    list="known-products"
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="e.g. Whole Chicken"
                  />
                  <datalist id="known-products">
                    {products.map((p) => <option key={p.id} value={p.name} />)}
                  </datalist>
                  {form.productName && (
                    <p className="text-xs">
                      {suggestion ? (
                        <span className="text-success">
                          Matches “{suggestion.name}” — stock will increase by the quantity entered.
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          New product — a manager will need to approve and set a price.
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Input
                      value={suggestion ? suggestion.category : form.category}
                      disabled={!!suggestion}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="e.g. Eggs"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={0}
                      required
                      value={String(form.quantity || "")}
                      onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. morning collection"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setOpenRecord(false)}>Cancel</Button>
                  <Button type="submit" disabled={incrementStock.isPending}>
                    {incrementStock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Entry
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading && Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!productsLoading && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No stock recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.productName}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-right">{e.quantity}{e.unit ? ` ${e.unit}` : ""}</TableCell>
                    <TableCell>{e.recordedBy}</TableCell>
                    <TableCell>{new Date(e.recordedAt).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {e.status === "pending" && isManager && (
                          <Button size="sm" variant="outline" onClick={() => { setApproving(e); setPriceForm({ unitPrice: 0, unit: "piece" }); }}>
                            <PackagePlus className="mr-1 h-3.5 w-3.5" />Add
                          </Button>
                        )}
                        {e.status === "pending" && isManager && (
                          <Button size="sm" variant="ghost" onClick={() => { stockStore.update(e.id, { status: "rejected" }); toast.success("Entry rejected"); }}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manager approval dialog */}
      <Dialog open={!!approving} onOpenChange={(v) => { if (!v) setApproving(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add “{approving?.productName}” to Products</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); approveMutation.mutate(); }}>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div><span className="text-muted-foreground">Category:</span> {approving?.category}</div>
              <div><span className="text-muted-foreground">Initial stock:</span> {approving?.quantity}</div>
              <div><span className="text-muted-foreground">Recorded by:</span> {approving?.recordedBy}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Unit Price</Label>
                <Input type="number" min={0} required
                  value={String(priceForm.unitPrice || "")}
                  onChange={(e) => setPriceForm({ ...priceForm, unitPrice: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">{formatCurrency(priceForm.unitPrice)}</p>
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Input value={priceForm.unit} onChange={(e) => setPriceForm({ ...priceForm, unit: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setApproving(null)}>Cancel</Button>
              <Button type="submit" disabled={approveMutation.isPending}>
                {approveMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Check className="mr-2 h-4 w-4" />}
                Create Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: StockEntry["status"] }) {
  const map: Record<StockEntry["status"], { label: string; className: string }> = {
    matched: { label: "Stock updated", className: "bg-success/15 text-success border-success/20" },
    pending: { label: "Pending approval", className: "bg-warning/15 text-warning-foreground border-warning/30" },
    approved: { label: "Approved", className: "bg-primary/10 text-primary border-primary/20" },
    rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
