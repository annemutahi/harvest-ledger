import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/invoices/$id")({
  head: ({ params }) => ({ meta: [{ title: `Invoice ${params.id} — Peaceful Acres ` }] }),
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

function InvoiceDetail() {
  // Guard against the loader returning undefined or missing invoice
  const loaderData = Route.useLoaderData() as { invoice?: unknown } | undefined;
  if (!loaderData || !loaderData.invoice) {
    return (
      <AppShell title="Invoice not found">
        <p className="text-muted-foreground">No such invoice.</p>
      </AppShell>
    );
  }

  const { invoice } = loaderData as { invoice: any };
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: api.listPayments });
  const pays = payments.filter((p: any) => p.invoiceId === invoice.id);

  return (
    <AppShell
      title={invoice.invoiceNumber}
      description={`Issued ${formatDate(invoice.invoiceDate)} · Due ${formatDate(invoice.dueDate)}`}
      actions={
        <>
          <Button variant="outline" asChild><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          {/* <Button><FileDown className="mr-2 h-4 w-4" />Download PDF</Button> */}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle>Invoice {invoice.invoiceNumber}</CardTitle>
              <StatusBadge status={invoice.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Billed to</p>
                <p className="mt-1 font-semibold">{invoice.customerName}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-medium uppercase text-muted-foreground">From</p>
                <p className="mt-1 font-semibold">Peaceful Acres Farm Limited</p>
                <p className="text-sm text-muted-foreground">Limuru Road, Kiambu</p>
                <p className="text-sm text-muted-foreground">accounts@greenharvest.farm</p>
              </div>
            </div>
            <Table className="mt-6">
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {invoice.items.map((it: typeof invoice.items[number], i: number) => (
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
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="text-success">{formatCurrency(invoice.amountPaid)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Balance Due</span><span className="text-earth">{formatCurrency(invoice.outstandingBalance)}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pays.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {pays.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.date)} · {p.method}</p>
                </div>
              </div>
            ))}
            <Button asChild className="w-full" variant="outline"><Link to="/payments/new">Record Payment</Link></Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
