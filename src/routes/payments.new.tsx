import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/mock-data";

export const Route = createFileRoute("/payments/new")({
  head: () => ({ meta: [{ title: "Record Payment — Peaceful Acres" }] }),
  component: RecordPaymentPage,
});

function RecordPaymentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"Cash" | "Bank Transfer" | "Mobile Money" | "Cheque">("Cash");
  const [notes, setNotes] = useState("");

  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: api.listInvoices });
  const createPaymentMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createPayment>[0]) => api.createPayment(payload),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      navigate({ to: "/transactions" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    },
  });

  const customerInvoices = useMemo(
    () => invoices.filter((i) => i.customerId === customerId && i.outstandingBalance > 0),
    [customerId, invoices],
  );

  const inv = invoices.find((i) => i.id === invoiceId);
  const remaining = inv ? Math.max(inv.outstandingBalance - amount, 0) : 0;

  return (
    <AppShell
      title="Record Payment"
      description="Apply a payment against a customer invoice."
      actions={<Button variant="outline" asChild><Link to="/transactions"><ArrowLeft className="mr-2 h-4 w-4" />Cancel</Link></Button>}
    >
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customerId || !invoiceId || amount <= 0) return;
          createPaymentMutation.mutate({ invoiceId, customerId, amount, method, notes });
        }}
      >
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setInvoiceId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Invoice</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId} disabled={!customerId}>
                <SelectTrigger><SelectValue placeholder={customerId ? "Select invoice" : "Choose a customer first"} /></SelectTrigger>
                <SelectContent>
                  {customerInvoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoiceNumber} — {formatCurrency(i.outstandingBalance)} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Amount (KES)</Label><Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional reference…" /></div>
            <Button type="submit" className="w-full" disabled={!inv || amount <= 0 || createPaymentMutation.isPending}>
              Record Payment
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Invoice Summary</CardTitle></CardHeader>
          <CardContent>
            {!inv ? (
              <p className="text-sm text-muted-foreground">Choose an invoice to see balance details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span>{formatCurrency(inv.totalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span className="text-success">{formatCurrency(inv.amountPaid)}</span></div>
                <div className="flex justify-between border-t pt-3"><span className="text-muted-foreground">Current Balance</span><span className="font-semibold text-earth">{formatCurrency(inv.outstandingBalance)}</span></div>
                <div className="flex justify-between rounded-lg bg-muted p-3"><span className="font-medium">After this payment</span><span className="font-bold">{formatCurrency(remaining)}</span></div>
                <p className="text-xs text-muted-foreground">Status will update to {remaining === 0 ? "Paid" : "Partially Paid"}.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </AppShell>
  );
}
