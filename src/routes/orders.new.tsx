import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/mock-data";
import { ordersStore } from "@/lib/orders-store";

export const Route = createFileRoute("/orders/new")({
  head: () => ({ meta: [{ title: "New Order — Peaceful Acres" }] }),
  component: NewOrderPage,
});

interface Line { productId: string; qty: number }

function NewOrderPage() {
  const navigate = useNavigate();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 1 }]);

  const total = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = products.find((x) => x.id === l.productId);
        return sum + (p ? p.unitPrice * l.qty : 0);
      }, 0),
    [lines, products],
  );

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const submit = () => {
    if (!customerName.trim()) return toast.error("Customer name is required");
    const items = lines
      .filter((l) => l.productId && l.qty > 0)
      .map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return {
          productId: p.id,
          productName: p.name,
          quantity: l.qty,
          unitPrice: p.unitPrice,
          total: p.unitPrice * l.qty,
        };
      });
    if (items.length === 0) return toast.error("Add at least one product");

    const order = ordersStore.create({
      reference: `IPO-${Date.now().toString().slice(-6)}`,
      channel: "in-person",
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      deliveryAddress: deliveryAddress.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      status: "confirmed",
    });
    // TODO(backend): POST /api/orders/  with channel="in-person"
    toast.success(`Order ${order.reference} recorded`);
    navigate({ to: "/orders" });
  };

  return (
    <AppShell
      title="New In-person Order"
      description="Record an order placed at the farm or over the phone."
      actions={
        <Button variant="outline" asChild>
          <Link to="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div>
              <Label>Delivery address</Label>
              <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((p) => [...p, { productId: "", qty: 1 }])}
              >
                <Plus className="mr-2 h-4 w-4" />Add line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const p = products.find((x) => x.id === line.productId);
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={line.productId}
                          onValueChange={(v) => updateLine(idx, { productId: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map((prod) => (
                              <SelectItem key={prod.id} value={prod.id}>
                                {prod.name} — {formatCurrency(prod.unitPrice)}
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
                          onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {p ? formatCurrency(p.unitPrice * line.qty) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold">{formatCurrency(total)}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" asChild><Link to="/orders">Cancel</Link></Button>
              <Button onClick={submit}>Save order</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
