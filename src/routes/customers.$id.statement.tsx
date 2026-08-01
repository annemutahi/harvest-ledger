import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportCsv, stampToday } from "@/lib/csv";
import { COMPANY } from "@/lib/company";
import type { Customer, Invoice, Payment } from "@/lib/types";

export const Route = createFileRoute("/customers/$id/statement")({
  head: () => ({
    meta: [
      { title: "Customer Statement — Peaceful Acres Farm" },
      {
        name: "description",
        content:
          "Consolidated statement of outstanding invoices, amounts and payment details for corporate customers.",
      },
      { property: "og:title", content: "Customer Statement — Peaceful Acres Farm" },
      {
        property: "og:description",
        content: "Consolidated statement of outstanding invoices for corporate customers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ params }) => {
    try {
      return { customer: await api.getCustomer(params.id) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  notFoundComponent: () => <p className="p-6 text-muted-foreground">Customer not found.</p>,
  errorComponent: ({ error }) => <p className="p-6 text-destructive">{error.message}</p>,
  component: StatementPage,
});

const itemDescription = (invoice: Invoice) =>
  invoice.items?.length
    ? invoice.items.map((i) => `${i.productName} x ${i.quantity}`).join(", ")
    : "—";

function StatementPage() {
  const { customer } = Route.useLoaderData() as { customer: Customer };
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(true);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", customer.id, from, to],
    queryFn: () =>
      api.listInvoices({ customer: customer.id, from: from || undefined, to: to || undefined }),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments(),
  });

  const paymentsByInvoice = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
      if (p.customerId !== customer.id) continue;
      const list = map.get(p.invoiceId) ?? [];
      list.push(p);
      map.set(p.invoiceId, list);
    }
    return map;
  }, [payments, customer.id]);

  const rows = useMemo(
    () =>
      invoices
        .filter((i) => (unpaidOnly ? i.status !== "Paid" : true))
        .map((invoice) => {
          const paid = (paymentsByInvoice.get(invoice.id) ?? []).slice().sort((a, b) =>
            a.date < b.date ? 1 : -1,
          );
          return {
            invoice,
            paymentDate: paid[0]?.date ?? "",
            paymentMode: paid.length
              ? Array.from(new Set(paid.map((p) => p.method))).join(", ")
              : "",
          };
        }),
    [invoices, unpaidOnly, paymentsByInvoice],
  );

  const totalInvoiced = rows.reduce((s, r) => s + r.invoice.totalAmount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.invoice.amountPaid, 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  const periodLabel =
    from || to
      ? `${from ? formatDate(from) : "Beginning"} — ${to ? formatDate(to) : "Date"}`
      : "All time";

  const handleExport = () => {
    exportCsv(
      `statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}-${stampToday()}.csv`,
      [
        "Invoice No",
        "Date Issued",
        "Item Description",
        "KRA ETIMS No.",
        "Invoice Amount",
        "Status",
        "Payment Date",
        "Payment Mode",
      ],
      rows.map((r) => [
        r.invoice.invoiceNumber,
        r.invoice.invoiceDate,
        itemDescription(r.invoice),
        "",
        r.invoice.totalAmount,
        r.invoice.status,
        r.paymentDate,
        r.paymentMode,
      ]),
      [
        ["Total Invoiced", totalInvoiced],
        ["Total Paid", totalPaid],
        ["Total Outstanding", totalOutstanding],
      ],
    );
  };

  return (
    <div className="print-document min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      {/* Controls — hidden on print */}
      <div className="mx-auto mb-4 max-w-5xl px-4 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/customers/$id" params={{ id: customer.id }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to customer
            </Link>
          </Button>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox
                checked={unpaidOnly}
                onCheckedChange={(v) => setUnpaidOnly(v === true)}
              />
              Unpaid only
            </label>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Statement document */}
      <div className="mx-auto max-w-5xl bg-background p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{COMPANY.name}</h1>
            <p className="text-sm text-muted-foreground">{COMPANY.location}</p>
            <p className="text-sm text-muted-foreground">{COMPANY.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Customer Statement
            </p>
            <p className="mt-1 text-lg font-semibold">{customer.company || customer.name}</p>
            <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
            <p className="text-xs text-muted-foreground">Issued: {formatDate(new Date().toISOString())}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Statement for</p>
            <p className="mt-1 font-medium">{customer.name}</p>
            {customer.contactPerson && <p className="text-muted-foreground">{customer.contactPerson}</p>}
            {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total Outstanding</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(totalOutstanding)}</p>
          </div>
        </section>

        <table className="w-full border-t text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-2 text-left font-semibold">Invoice No</th>
              <th className="py-2 pr-2 text-left font-semibold">Date Issued</th>
              <th className="py-2 pr-2 text-left font-semibold">Item Description</th>
              <th className="py-2 pr-2 text-left font-semibold">KRA ETIMS No.</th>
              <th className="py-2 pr-2 text-right font-semibold">Invoice Amount</th>
              <th className="py-2 pr-2 text-left font-semibold">Status</th>
              <th className="py-2 pr-2 text-left font-semibold">Payment Date</th>
              <th className="py-2 text-left font-semibold">Payment Mode</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No invoices for this period.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.invoice.id} className="border-b align-top">
                <td className="py-2 pr-2 font-medium">{r.invoice.invoiceNumber}</td>
                <td className="py-2 pr-2">{formatDate(r.invoice.invoiceDate)}</td>
                <td className="py-2 pr-2">{itemDescription(r.invoice)}</td>
                <td className="py-2 pr-2 text-muted-foreground">&nbsp;</td>
                <td className="py-2 pr-2 text-right">{formatCurrency(r.invoice.totalAmount)}</td>
                <td className="py-2 pr-2">{r.invoice.status}</td>
                <td className="py-2 pr-2">{r.paymentDate ? formatDate(r.paymentDate) : "—"}</td>
                <td className="py-2">{r.paymentMode || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-b">
              <td colSpan={4} className="py-2 pr-2 text-right font-medium">Total Invoiced</td>
              <td className="py-2 pr-2 text-right font-medium">{formatCurrency(totalInvoiced)}</td>
              <td colSpan={3} />
            </tr>
            <tr className="border-b">
              <td colSpan={4} className="py-2 pr-2 text-right font-medium">Total Paid</td>
              <td className="py-2 pr-2 text-right font-medium">{formatCurrency(totalPaid)}</td>
              <td colSpan={3} />
            </tr>
            <tr>
              <td colSpan={4} className="py-3 pr-2 text-right font-semibold">Total Outstanding</td>
              <td className="py-3 pr-2 text-right font-semibold">{formatCurrency(totalOutstanding)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
          KRA ETIMS numbers are left blank for manual completion. Please settle outstanding
          balances to {COMPANY.name} — {COMPANY.phone}.
        </p>
      </div>
    </div>
  );
}
