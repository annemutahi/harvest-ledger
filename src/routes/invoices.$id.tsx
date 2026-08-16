import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, Ban, Printer, Pencil, Plus, Trash2, Save, X } from "lucide-react";
import { VoidDialog } from "@/components/void-dialog";
import { useAuth } from "@/lib/auth-context";
import { isManager } from "@/lib/permissions";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceAdjustment, SaleItem } from "@/lib/types";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/invoices/$id")({
  head: ({ params }) => ({ meta: [{ title: `Invoice ${params.id}` }] }),
  loader: async ({ params }) => {
    try {
      const invoice = await api.getInvoice(params.id);
      return { invoice };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  notFoundComponent: () => (
    <AppShell title="Invoice not found"><p className="text-muted-foreground">No such invoice.</p></AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell title="Error"><p>{error.message}</p></AppShell>
  ),
  component: InvoiceDetail,
});

type EditableLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

function InvoiceDetail() {
  const loaderData = Route.useLoaderData() as { invoice?: any } | undefined;
  const initialInvoice = loaderData?.invoice;
  const qc = useQueryClient();
  const { user } = useAuth();
  const mayVoid = isManager(user);

  const { data: invoice = initialInvoice } = useQuery({
    queryKey: ["invoices", initialInvoice?.id],
    queryFn: () => api.getInvoice(initialInvoice.id),
    initialData: initialInvoice,
    enabled: !!initialInvoice?.id,
  });

  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => api.listPayments() });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });

  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [etims, setEtims] = useState<string | null>(null);
  const etimsValue = etims ?? invoice?.etimsNumber ?? "";

  const saveEtims = useMutation({
    mutationFn: () => api.updateInvoiceEtims(invoice.id, etimsValue.trim()),
    onSuccess: () => {
      setEtims(null);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("KRA eTIMS number saved.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save eTIMS number"),
  });

  const refreshAfterVoid = () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const voidInvoice = useMutation({
    mutationFn: (reason: string) => api.voidInvoice(invoice.id, reason),
    onSuccess: () => {
      refreshAfterVoid();
      toast.success("Invoice voided");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not void this invoice"),
  });

  const voidPayment = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.voidPayment(id, reason),
    onSuccess: () => {
      refreshAfterVoid();
      toast.success("Payment voided and reversed off the invoice");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not void this payment"),
  });

  const startEdit = () => {
    setLines(
      (invoice.items as SaleItem[]).map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
    );
    setAdjustmentNote("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setLines([]);
    setAdjustmentNote("");
  };

  const addLine = () => {
    const p = products[0];
    setLines((ls) => [
      ...ls,
      {
        productId: p?.id ?? "",
        productName: p?.name ?? "",
        quantity: 1,
        unitPrice: Number(p?.unitPrice ?? 0),
      },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<EditableLine>) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  };

  const editingTotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0),
    [lines],
  );
  const diff = editingTotal - Number(invoice?.totalAmount ?? 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.saleId) {
        throw new Error("This invoice is not linked to an editable sale.");
      }
      if (lines.length === 0) throw new Error("Add at least one line item.");
      for (const l of lines) {
        if (!l.productId) throw new Error("Every line must have a product.");
        if (l.quantity <= 0) throw new Error("Quantities must be greater than zero.");
        if (l.unitPrice < 0) throw new Error("Unit price must be zero or positive.");
      }
      return api.updateSale(invoice.saleId, {
        customerId: invoice.customerId,
        paymentType: invoice.paymentType ?? "Credit",
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        adjustmentNote,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
    },
    onSuccess: () => {
      const delta = diff;
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", invoice.id] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditing(false);
      setAdjustmentNote("");
      if (Math.abs(delta) < 0.005) {
        toast.success("Invoice updated");
      } else if (delta > 0) {
        toast.success(
          `Invoice updated. Debit note issued for ${formatCurrency(delta)} (added charge).`,
        );
      } else {
        toast.success(
          `Invoice updated. Credit note issued for ${formatCurrency(Math.abs(delta))} (refund/credit).`,
        );
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  if (!invoice) {
    return (
      <AppShell title="Invoice not found">
        <p className="text-muted-foreground">No such invoice.</p>
      </AppShell>
    );
  }

  const pays = payments.filter((p: any) => p.invoiceId === invoice.id);
  const canEdit = !!invoice.saleId && !invoice.isVoided;
  const isCredit = invoice.outstandingBalance < 0;

  return (
    <AppShell
      title={invoice.invoiceNumber}
      description={`Issued ${formatDate(invoice.invoiceDate)} · Due ${formatDate(invoice.dueDate)}`}
      actions={
        <>
          <Button variant="outline" asChild><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          {!editing && canEdit && (
            <Button onClick={startEdit}><Pencil className="mr-2 h-4 w-4" />Edit items</Button>
          )}
          {!editing && mayVoid && !invoice.isVoided && (
            <VoidDialog
              title={`Void ${invoice.invoiceNumber}?`}
              description="The invoice stays on record but is cancelled: it is excluded from statements, receivables and reports, and its stock is returned."
              pending={voidInvoice.isPending}
              onConfirm={async (reason) => { await voidInvoice.mutateAsync(reason); }}
              trigger={
                <Button variant="outline" className="text-destructive">
                  <Ban className="mr-2 h-4 w-4" />Void invoice
                </Button>
              }
            />
          )}
        </>
      }
    >
      <div className="print-document grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold tracking-tight">INVOICE</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={invoice.status} />
                <img
                  src="/assets/favicon.png"
                  alt={`${COMPANY.name} logo`}
                  className="h-16 w-16 shrink-0 rounded-full object-contain"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {invoice.isVoided && (
              <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <p className="text-sm font-semibold text-destructive">VOIDED</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {invoice.voidReason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Voided {formatDate(invoice.voidedAt ?? "")}
                  {invoice.voidedByName ? ` by ${invoice.voidedByName}` : ""}
                </p>
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Billed to</p>
                <p className="mt-1 font-semibold">{invoice.customerName}</p>
                {/* <p className="mt-1 font-semibold">{invoice.customerPhone}</p>
                <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p> */}
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-medium uppercase text-muted-foreground">From</p>
                <p className="mt-1 font-semibold">{COMPANY.name}</p>
                <p className="text-sm text-muted-foreground">{COMPANY.email}</p>
                <p className="text-sm text-muted-foreground">{COMPANY.phone}</p>
                <p className="text-sm text-muted-foreground">{COMPANY.location}</p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">KRA eTIMS No.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
                <Input
                  value={etimsValue}
                  onChange={(e) => setEtims(e.target.value)}
                  placeholder="Enter eTIMS number once available"
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saveEtims.isPending || etimsValue.trim() === (invoice.etimsNumber ?? "")}
                  onClick={() => saveEtims.mutate()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveEtims.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="mt-2 hidden text-sm font-medium print:block">
                {invoice.etimsNumber || "—"}
              </p>
            </div>

            {!editing ? (
              <>
                <Table className="mt-6">
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoice.items.map((it: SaleItem, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{it.productName}</TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(it.unitPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(it.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="ml-auto mt-6 max-w-sm space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span>{formatCurrency(invoice.totalAmount)}</span></div>
                  {invoice.creditApplied > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Credit applied</span><span className="text-success">−{formatCurrency(invoice.creditApplied)}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="text-success">{formatCurrency(invoice.amountPaid)}</span></div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>{isCredit ? "Overdraft" : "Balance Due"}</span>
                    <span className={isCredit ? "text-destructive" : "text-earth"}>{formatCurrency(Math.abs(invoice.outstandingBalance))}</span>
                  </div>
                </div>
                {invoice.adjustments.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Invoice changes</p>
                    <div className="mt-3 space-y-3">
                      {invoice.adjustments.map((adjustment: InvoiceAdjustment) => (
                        <div key={adjustment.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex justify-between gap-3 font-medium">
                            <span>{adjustment.kind} note</span>
                            <span>{formatCurrency(adjustment.amount)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(adjustment.previousTotal)} → {formatCurrency(adjustment.newTotal)} · {formatDate(adjustment.createdAt)}
                          </p>
                          {adjustment.notes && <p className="mt-2 text-muted-foreground">{adjustment.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-6 space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-2/5">Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const total = Number(l.quantity || 0) * Number(l.unitPrice || 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select
                              value={l.productId}
                              onValueChange={(v) => {
                                const p = products.find((x: any) => x.id === v);
                                updateLine(idx, {
                                  productId: v,
                                  productName: p?.name ?? l.productName,
                                  unitPrice: p ? Number(p.unitPrice) : l.unitPrice,
                                });
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                              <SelectContent>
                                {products.map((p: any) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="text-right"
                              value={l.quantity}
                              onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="text-right"
                              value={l.unitPrice}
                              onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-2 h-4 w-4" />Add line
                </Button>

                <div className="ml-auto max-w-sm space-y-2 border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Previous total</span>
                    <span>{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New total</span>
                    <span>{formatCurrency(editingTotal)}</span>
                  </div>
                  <div className={`flex justify-between border-t pt-2 text-sm font-semibold ${diff > 0 ? "text-earth" : diff < 0 ? "text-success" : ""}`}>
                    <span>
                      {diff > 0 ? "Debit note (added charge)" : diff < 0 ? "Credit note (refund)" : "No change"}
                    </span>
                    <span>{formatCurrency(Math.abs(diff))}</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="adjustment-note">Reason for this invoice change</label>
                  <Textarea
                    id="adjustment-note"
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    placeholder="Optional note shown with the debit or credit adjustment."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={cancelEdit} disabled={saveMutation.isPending}>
                    <X className="mr-2 h-4 w-4" />Cancel
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pays.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {pays.map((p) => (
              <div
                key={p.id}
                className={`flex items-start justify-between gap-2 rounded-lg border p-3 ${p.isVoided ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${p.isVoided ? "line-through" : ""}`}>
                    {formatCurrency(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.date)} · {p.method}</p>
                  {p.notes && <p className="mt-1 break-words text-xs text-muted-foreground italic">{p.notes}</p>}
                  {p.isVoided && (
                    <p className="mt-1 break-words text-xs text-destructive">
                      Voided{p.voidedByName ? ` by ${p.voidedByName}` : ""}: {p.voidReason}
                    </p>
                  )}
                </div>
                {mayVoid && !p.isVoided && (
                  <VoidDialog
                    title="Void this payment?"
                    description="The payment stays on record but is reversed off the invoice balance."
                    pending={voidPayment.isPending}
                    onConfirm={async (reason) => { await voidPayment.mutateAsync({ id: p.id, reason }); }}
                    trigger={
                      <Button variant="ghost" size="icon" className="print:hidden" title="Void payment">
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  />
                )}
              </div>
            ))}
            <Button asChild className="w-full print:hidden" variant="outline"><Link to="/payments/new">Record Payment</Link></Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
