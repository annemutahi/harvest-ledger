import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { customers, products, formatCurrency } from "@/lib/mock-data";

export const Route = createFileRoute("/sales/new")({
  head: () => ({ meta: [{ title: "New Sale — Peaceful Acres" }] }),
  component: NewSalePage,
});

interface Line { productId: string; qty: number; }

function NewSalePage() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 1 }]);

  const total = useMemo(() => lines.reduce((s, l) => {
    const p = products.find((x) => x.id === l.productId);
    return s + (p ? p.unitPrice * l.qty : 0);
  }, 0), [lines]);

  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  return (
    <AppShell
      title="New Sale"
      description="Record a sale and auto-generate an invoice."
      actions={<Button variant="outline" asChild><Link to="/sales"><ArrowLeft className="mr-2 h-4 w-4" />Cancel</Link></Button>}
    >
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          // TODO: POST /api/sales/  → creates Sale + Invoice
          toast.success("Sale recorded. Invoice generated.");
          navigate({ to: "/sales" });
        }}
      >
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => {
                  const p = products.find((x) => x.id === l.productId);
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={l.productId} onValueChange={(v) => update(i, { productId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" min={1} value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value) })} /></TableCell>
                      <TableCell className="text-right">{p ? formatCurrency(p.unitPrice) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{p ? formatCurrency(p.unitPrice * l.qty) : "—"}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Button type="button" variant="outline" className="mt-4" onClick={() => setLines((p) => [...p, { productId: "", qty: 1 }])}>
              <Plus className="mr-2 h-4 w-4" />Add Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId} required>
                <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(total)}</span></div>
              <div className="mt-3 flex justify-between border-t pt-3"><span className="font-semibold">Total</span><span className="text-lg font-bold text-primary">{formatCurrency(total)}</span></div>
            </div>
            <Button type="submit" className="w-full" disabled={!customerId || total === 0}>Record Sale & Generate Invoice</Button>
          </CardContent>
        </Card>
      </form>
    </AppShell>
  );
}
