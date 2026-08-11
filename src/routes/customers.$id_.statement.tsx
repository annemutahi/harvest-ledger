import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, FileDown, Sheet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { exportCsv, stampToday } from "@/lib/csv";
import { COMPANY } from "@/lib/company";
import type { CreditUse, Customer, Invoice, Payment } from "@/lib/types";

export const Route = createFileRoute("/customers/$id_/statement")({
  head: () => ({
    meta: [
      { title: "Customer Statement" },
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
    ? invoice.items.map((i) => `${i.productName}x${i.quantity}`).join(", ")
    : "—";

const getInvoiceStatus = (invoice: Invoice) => {
  if (invoice.status === "Credit") return "Credit";
  if (invoice.status === "Overdue") return "Overdue";
  if (invoice.amountPaid >= invoice.totalAmount && invoice.totalAmount > 0) return "Paid";
  if (invoice.amountPaid > 0) return "Partially Paid";
  return "Unpaid";
};

const num = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });

const creditNote = (uses: CreditUse[]) =>
  `Credit used: ${uses
    .map((u) => `KSh ${num(u.amount)} on ${u.targetInvoiceNumber}`)
    .join("; ")}`;

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
        .filter((i) => (unpaidOnly ? getInvoiceStatus(i) !== "Paid" : true))
        .map((invoice) => {
          const paid = (paymentsByInvoice.get(invoice.id) ?? []).slice().sort((a, b) =>
            a.date < b.date ? 1 : -1,
          );
          const cashSettled =
            paid.length === 0 &&
            invoice.paymentType === "Cash" &&
            invoice.amountPaid > 0;
          const creditUses = invoice.creditUses ?? [];
          const creditUsed = creditUses.reduce((s, u) => s + u.amount, 0);
          return {
            invoice,
            status: getInvoiceStatus(invoice),
            creditUses,
            // Credit spent on other invoices is no longer money held for the customer.
            effectivePaid: invoice.amountPaid - creditUsed,
            paymentDate: paid[0]?.date ?? (cashSettled ? invoice.invoiceDate : ""),
            paymentMode: paid.length
              ? Array.from(new Set(paid.map((p) => p.method))).join(", ")
              : cashSettled
                ? "Cash"
                : "",
          };
        }),
    [invoices, unpaidOnly, paymentsByInvoice],
  );

  const totalInvoiced = rows.reduce((s, r) => s + r.invoice.totalAmount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.effectivePaid, 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  const asAtLabel = `AS AT ${formatDate(to || new Date().toISOString()).toUpperCase()}`;
  const periodLabel =
    from || to
      ? `${from ? formatDate(from) : "Beginning"} - ${to ? formatDate(to) : "Date"}`
      : "All time";

  const slug = customer.name.replace(/\s+/g, "-").toLowerCase();

  const tableRows = rows.flatMap((r) => {
    const row: (string | number)[] = [
      r.invoice.invoiceDate,
      r.invoice.invoiceNumber,
      itemDescription(r.invoice),
      r.invoice.etimsNumber || "",
      r.invoice.totalAmount,
      r.status,
      r.paymentDate,
      r.paymentMode,
    ];
    return r.creditUses.length
      ? [row, ["", "", creditNote(r.creditUses), "", "", "", "", ""]]
      : [row];
  });

  const headers = [
    "DATE",
    "INVOICE NO",
    "ITEM DESCRIPTION",
    "KRA ETIMS NO.",
    "INVOICE AMOUNT (KSHS)",
    "STATUS",
    "PAYMENT DATE",
    "PAYMENT MODE",
  ];

  const handleExportCsv = () => {
    exportCsv(`statement-${slug}-${stampToday()}.csv`, headers, tableRows, [
      ["", "", "TOTAL", "", totalInvoiced],
      ["", "", "TOTAL PAID", "", totalPaid],
      ["", "", "TOTAL OUTSTANDING", "", totalOutstanding],
    ]);
  };

  const handleExportExcel = () => {
    const aoa: (string | number)[][] = [
      [COMPANY.name.toUpperCase()],
      [COMPANY.location.toUpperCase()],
      [COMPANY.email],
      [`STATEMENT — ${(customer.company || customer.name).toUpperCase()}`],
      [asAtLabel],
      [],
      headers,
      ...tableRows,
      [],
      ["", "", "TOTAL", "", totalInvoiced],
      ["", "", "TOTAL PAID", "", totalPaid],
      ["", "", "TOTAL OUTSTANDING", "", totalOutstanding],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 22 },
      { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `statement-${slug}-${stampToday()}.xlsx`);
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
              <Checkbox checked={unpaidOnly} onCheckedChange={(v) => setUnpaidOnly(v === false)} />
              Unpaid only
            </label>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Sheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
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
        <header className="flex items-center gap-6 border-b pb-6">
          <img src="/assets/favicon.png" alt={`${COMPANY.name} logo`} className="h-20 w-20 rounded-full" />
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold uppercase tracking-tight">{COMPANY.name}</h1>
            <p className="text-sm text-muted-foreground">{COMPANY.location}</p>
            <p className="text-sm text-muted-foreground">{COMPANY.email}</p>
            <p className="text-sm text-muted-foreground">{COMPANY.phone}</p>
            <p className="mt-2 text-sm font-semibold uppercase">
              Statement - {customer.company || customer.name}
            </p>
            <p className="text-sm font-semibold uppercase">{asAtLabel}</p>
            <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
          </div>
          <div className="h-20 w-20" aria-hidden />
        </header>

        <table className="mt-6 w-full border border-foreground/40 text-sm">
          <thead>
            <tr className="border-b border-foreground/40">
              <th className="border-r border-foreground/40 px-2 py-2 text-left font-bold">DATE</th>
              <th className="border-r border-foreground/40 px-2 py-2 text-right font-bold">INVOICE NO</th>
              <th className="border-r border-foreground/40 px-2 py-2 text-left font-bold">ITEM DESCRIPTION</th>
              <th className="border-r border-foreground/40 px-2 py-2 text-center font-bold">KRA ETIMS NO.</th>
              <th className="border-r border-foreground/40 px-2 py-2 text-right font-bold">INVOICE AMOUNT (KSHS)</th>
              <th className="border-r border-foreground/40 px-2 py-2 text-left font-bold">STATUS</th>
              <th className="border-r border-foreground/40 px-2 py-2 text-left font-bold">PAYMENT DATE</th>
              <th className="px-2 py-2 text-left font-bold">PAYMENT MODE</th>
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
              <Fragment key={r.invoice.id}>
                <tr className="border-b border-foreground/20">
                  <td className="border-r border-foreground/40 px-2 py-1 text-right">{formatDate(r.invoice.invoiceDate)}</td>
                  <td className="border-r border-foreground/40 px-2 py-1 text-right">{r.invoice.invoiceNumber}</td>
                  <td className="border-r border-foreground/40 px-2 py-1">{itemDescription(r.invoice)}</td>
                  <td className="border-r border-foreground/40 px-2 py-1 text-center">{r.invoice.etimsNumber || "\u00A0"}</td>
                  <td className="border-r border-foreground/40 px-2 py-1 text-right">{num(r.invoice.totalAmount)}</td>
                  <td className="border-r border-foreground/40 px-2 py-1">{r.status}</td>
                  <td className="border-r border-foreground/40 px-2 py-1">{r.paymentDate ? formatDate(r.paymentDate) : ""}</td>
                  <td className="px-2 py-1">{r.paymentMode}</td>
                </tr>
                {r.creditUses.length > 0 && (
                  <tr className="border-b border-foreground/20">
                    <td className="border-r border-foreground/40 px-2 py-1" />
                    <td colSpan={7} className="px-2 py-1 text-xs italic text-muted-foreground">
                      {creditNote(r.creditUses)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground/40">
              <td colSpan={4} className="border-r border-foreground/40 px-2 py-2 text-center font-bold">TOTAL</td>
              <td className="border-r border-foreground/40 px-2 py-2 text-right font-bold">{num(totalInvoiced)}</td>
              <td colSpan={3} />
            </tr>
            <tr>
              <td colSpan={4} className="border-r border-foreground/40 px-2 py-2 text-center font-medium">TOTAL PAID</td>
              <td className="border-r border-foreground/40 px-2 py-2 text-right font-medium">{num(totalPaid)}</td>
              <td colSpan={3} />
            </tr>
            <tr>
              <td colSpan={4} className="border-r border-foreground/40 px-2 py-2 text-center font-bold">TOTAL OUTSTANDING</td>
              <td className="border-r border-foreground/40 px-2 py-2 text-right font-bold">{num(totalOutstanding)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
          Please settle outstanding balances to {COMPANY.name} - {COMPANY.phone}.
        </p>
      </div>
    </div>
  );
}
