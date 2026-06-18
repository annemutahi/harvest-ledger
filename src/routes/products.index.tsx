import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Plus, Search, Loader2, Edit3, Trash } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, type Product } from "@/lib/mock-data";

export const Route = createFileRoute("/products/")({
  head: () => ({ meta: [{ title: "Products — Peaceful Acres" }] }),
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

  return (
    <AppShell title="Products" description="Manage inventory and pricing.">
      <Card>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

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
                    <TableCell className="text-right">{p.availableQuantity}</TableCell>
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
