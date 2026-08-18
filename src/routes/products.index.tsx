import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Plus, Search, Loader2, Edit3, Trash, Package, AlertTriangle, Layers, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/products/")({
  head: () => ({ meta: [{ title: "Products" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: products, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });

  const [form, setForm] = useState<Partial<Product>>({ name: "", category: "", unitPrice: 0, availableQuantity: 0, unit: "piece" });

  const createMutation = useMutation({
    mutationFn: () => api.createProduct(form),
    onSuccess: () => {
      toast.success("Product created");
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpenAdd(false);
      setForm({ name: "", category: "", unitPrice: 0, availableQuantity: 0, unit: "piece" });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to create product"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => api.updateProduct(id, data),
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to update product"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to delete product"),
  });

  const filtered = (products ?? []).filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.category.toLowerCase().includes(q.toLowerCase());
    return matchQ;
  });

  const maxQty = Math.max(1, ...(filtered.map((p) => p.availableQuantity)));

  function StockBar({ quantity }: { quantity: number }) {
    const pct = Math.min(100, Math.max(0, (quantity / maxQty) * 100));
    const level = quantity <= 10 ? "bg-destructive" : quantity <= 30 ? "bg-warning" : "bg-success";
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-medium">{quantity}</span>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${level}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  const summary = useMemo(() => {
    const list = products ?? [];
    const totalValue = list.reduce((sum, p) => sum + p.availableQuantity * p.unitPrice, 0);
    const lowStock = list.filter((p) => p.availableQuantity <= 10).length;
    const categories = Array.from(new Set(list.map((p) => p.category).filter(Boolean)));
    const byCategory = categories.map((category) => ({
      category,
      quantity: list.filter((p) => p.category === category).reduce((sum, p) => sum + p.availableQuantity, 0),
      value: list.filter((p) => p.category === category).reduce((sum, p) => sum + p.availableQuantity * p.unitPrice, 0),
      items: list.filter((p) => p.category === category).length,
    }));
    const maxCategoryQty = Math.max(1, ...byCategory.map((c) => c.quantity));
    return { totalValue, lowStock, totalProducts: list.length, categoryCount: categories.length, byCategory, maxCategoryQty };
  }, [products]);

  function SummaryBar({ quantity, label, sublabel, tone }: { quantity: number; label: string; sublabel: string; tone?: "primary" | "earth" | "success" | "warning" | "destructive" }) {
    const pct = Math.min(100, Math.max(0, (quantity / summary.maxCategoryQty) * 100));
    const toneClass = tone ? {
      primary: "bg-primary",
      earth: "bg-earth",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
    }[tone] : "bg-primary";
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">{sublabel}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", toneClass)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Products"
      actions={
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Search by name or category" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
    </div>
    <Dialog open={openAdd} onOpenChange={setOpenAdd}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Product</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <div className="grid gap-2"><Label>Product Name</Label>
            <Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-2"><Label>Category</Label>
            <Input required value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Unit Price</Label>
              <Input type="number" value={String(form.unitPrice ?? "")} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) || 0 })} />
            </div>
            <div className="grid gap-2"><Label>Available Quantity</Label>
              <Input type="number" value={String(form.availableQuantity ?? "")} onChange={(e) => setForm({ ...form, availableQuantity: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
      }
    >

      {/* Inventory summary */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold tracking-tight">{summary.totalProducts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-earth/15 text-earth">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Inventory Value</p>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(summary.totalValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold tracking-tight">{summary.lowStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold tracking-tight">{summary.categoryCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-14" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
                {!isLoading && error && (
                  <TableRow><TableCell colSpan={5} className="py-12 text-center text-destructive">{error instanceof Error ? error.message : "Failed to load products"}</TableCell></TableRow>
                )}
                {!isLoading && !error && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No products match your search.</TableCell></TableRow>
                )}
                {!isLoading && !error && filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.unitPrice)}</TableCell>
                    <TableCell className="text-right"><StockBar quantity={p.availableQuantity} /></TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setForm({ name: p.name, category: p.category, unitPrice: p.unitPrice, availableQuantity: p.availableQuantity }); }}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Trash className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            </AlertDialogHeader>
                            <p>Are you sure you want to delete "{p.name}"? This action cannot be undone.</p>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!editing) return; updateMutation.mutate({ id: editing.id, data: form }); }}>
            <div className="grid gap-2"><Label>Product Name</Label>
              <Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2"><Label>Category</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Unit Price</Label>
                <Input type="number" value={String(form.unitPrice ?? "") } onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2"><Label>Available Quantity</Label>
                <Input type="number" value={String(form.availableQuantity ?? "")} onChange={(e) => setForm({ ...form, availableQuantity: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
