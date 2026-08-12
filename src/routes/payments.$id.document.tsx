import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/payments/$id/document")({
  head: ({ params }) => ({
    meta: [{ title: `Payment Receipt ${params.id}` }],
  }),
  component: PaymentDocumentPage,
});

function PaymentDocumentPage() {
  const { id } = Route.useParams();
  const { data: payment, isLoading, isError } = useQuery({
    queryKey: ["payments", id],
    queryFn: () => api.getPayment(id),
    retry: false,
  });

  useEffect(() => {
    if (payment) document.title = `Receipt ${payment.invoiceNumber}`;
  }, [payment]);

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (isError || !payment) throw notFound();

  return (
    <div className="print-document min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      {/* Toolbar (hidden on print) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/transactions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to transactions
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Download / Print
        </Button>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-3xl bg-background p-8 shadow-sm print:max-w-none print:shadow-none print:p-0">
        <header className="border-b pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold uppercase tracking-tight">Receipt</h1>
              <p className="mt-3 font-semibold">{COMPANY.name}</p>
              <p className="text-sm text-muted-foreground">{COMPANY.email}</p>
              <p className="text-sm text-muted-foreground">{COMPANY.phone}</p>
              <p className="text-sm text-muted-foreground">{COMPANY.location}</p>
            </div>
            <img
              src="/assets/favicon.png"
              alt={`${COMPANY.name} logo`}
              className="h-20 w-20 shrink-0 rounded-full object-contain"
            />
          </div>
          <div className="mt-4 text-right">
            <p className="text-lg font-semibold">{payment.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">Paid: {formatDate(payment.date)}</p>
            <p className="mt-2 inline-block rounded border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              PAID
            </p>
          </div>
        </header>


        <section className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Received from</p>
            <p className="mt-1 font-medium">{payment.customerName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Payment Method</p>
            <p className="mt-1 font-medium">{payment.method}</p>
          </div>
        </section>

        <table className="w-full border-t text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b last:border-b-0">
              <td className="py-2">
                Payment for invoice {payment.invoiceNumber}
                {payment.notes && <span className="block text-xs text-muted-foreground">{payment.notes}</span>}
              </td>
              <td className="py-2 text-right font-semibold">{formatCurrency(payment.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Amount Received</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
        </div>

        <footer className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
          Thank you. This receipt confirms payment received.
        </footer>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
