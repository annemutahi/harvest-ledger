import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, type Product } from "@/lib/mock-data";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Products — Peaceful Acres" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: api.listProducts,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    (products ?? []).forEach((p) => {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    });
    return Array.from(map.entries());
  }, [products]);

  const filtered = (products ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.category.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell
      title="Produce Catalogue"
      description="Browse Peaceful Acres' fresh, organic poultry products."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
              <div className="grid gap-2"><Label>Product Name</Label><Input placeholder="e.g. Chicken Feet" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Category</Label><Input placeholder="Chicken Cuts" /></div>
                <div className="grid gap-2"><Label>Unit</Label><Input placeholder="kg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Unit Price (KES)</Label><Input type="number" /></div>
                <div className="grid gap-2"><Label>Available Qty</Label><Input type="number" /></div>
              </div>
              <DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Category carousels */}
      <div className="space-y-8 animate-fade-in">
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, j) => (
                    <Skeleton key={j} className="h-36 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ))
          : grouped.map(([category, items]) => (
              <section key={category}>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{category}</h2>
                    <p className="text-xs text-muted-foreground">{items.length} product{items.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <Carousel opts={{ align: "start", loop: false }} className="px-10">
                  <CarouselContent>
                    {items.map((p) => (
                      <CarouselItem key={p.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                        <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
                          <CardContent className="flex h-full flex-col gap-2 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-base font-semibold leading-tight">{p.name}</h3>
                              <Badge variant="secondary" className="shrink-0">{p.unit}</Badge>
                            </div>
                            {p.description && (
                              <p className="text-xs text-muted-foreground">{p.description}</p>
                            )}
                            <div className="mt-auto flex items-center justify-between pt-3">
                              <span className="text-xl font-bold text-primary">{formatCurrency(p.unitPrice)}</span>
                              <span className="text-xs text-muted-foreground">{p.availableQuantity} in stock</span>
                            </div>
                          </CardContent>
                        </Card>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="-left-2" />
                  <CarouselNext className="-right-2" />
                </Carousel>
              </section>
            ))}
      </div>

      {/* Full table */}
      <Card className="mt-8">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Available</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                {!isLoading && filtered.map((p) => (
                  <TableRow key={p.id} className="animate-fade-in">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(p.unitPrice)} <span className="text-xs text-muted-foreground">/ {p.unit}</span></TableCell>
                    <TableCell className="text-right">{p.availableQuantity} {p.unit}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
