import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, ReceiptText, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { COMPANY } from "@/lib/company";

type DocFormat = "invoice" | "receipt";

export const Route = createFileRoute("/orders/$id/document")({
  head: ({ params }) => ({
    meta: [{ title: `Order ${params.id}` }],
  }),
  validateSearch: (s: Record<string, unknown>): { format?: DocFormat } => ({
    format: s.format === "receipt" ? "receipt" : "invoice",
  }),
  component: OrderDocumentPage,
});

function OrderDocumentPage() {
  const { id } = Route.useParams();
  const { format = "invoice" } = useSearch({ from: Route.id });
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.getOrder(id),
    retry: false,
  });

  useEffect(() => {
    if (order) document.title = `${format === "receipt" ? "Receipt" : "Invoice"} ${order.reference}`;
  }, [order, format]);

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (isError || !order) throw notFound();

  const isReceipt = format === "receipt";
  const paid = isReceipt || order.status === "delivered";

  return (
    <div className="print-document min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      {/* Toolbar (hidden on print) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/orders/$id" params={{ id }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to order
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/orders/$id/document"
              params={{ id }}
              search={{ format: isReceipt ? "invoice" : "receipt" }}
            >
              {isReceipt ? (
                <><FileText className="mr-2 h-4 w-4" />View as Invoice</>
              ) : (
                <><ReceiptText className="mr-2 h-4 w-4" />Convert to Receipt</>
              )}
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Download / Print
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-3xl bg-background p-8 shadow-sm print:max-w-none print:shadow-none print:p-0">
        <header className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{COMPANY.name}</h1>
            <p className="text-sm text-muted-foreground">{COMPANY.location}</p>
            <p className="text-sm text-muted-foreground">{COMPANY.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isReceipt ? "Receipt" : "Invoice"}
            </p>
            <p className="mt-1 text-lg font-semibold">{order.reference}</p>
            <p className="text-xs text-muted-foreground">
              {isReceipt ? "Issued" : "Placed"}: {formatDate(order.placedAt)}
            </p>
            {paid && (
              <p className="mt-2 inline-block rounded border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                PAID
              </p>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {isReceipt ? "Received from" : "Billed to"}
            </p>
            <p className="mt-1 font-medium">{order.customerName}</p>
            {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
            {order.customerEmail && <p className="text-muted-foreground">{order.customerEmail}</p>}
            {order.deliveryAddress && <p className="text-muted-foreground">{order.deliveryAddress}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Channel</p>
            <p className="mt-1 capitalize">{order.channel}</p>
            {order.storeSource && (
              <>
                <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Source</p>
                <p className="capitalize">{order.storeSource}</p>
              </>
            )}
            <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Status</p>
            <p className="capitalize">{order.status}</p>
          </div>
        </section>

        <table className="w-full border-t text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={idx} className="border-b last:border-b-0">
                <td className="py-2">{i.productName}</td>
                <td className="py-2 text-right">{i.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(i.unitPrice)}</td>
                <td className="py-2 text-right">{formatCurrency(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>{isReceipt ? "Amount Paid" : "Total Due"}</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          {!isReceipt && !paid && (
            <p className="pt-2 text-xs text-muted-foreground">
              Payment due on delivery.
            </p>
          )}
        </div>

        {order.notes && (
          <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Notes: </span>
            {order.notes}
          </p>
        )}

        <footer className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
          {isReceipt
            ? "Thank you for your business. This receipt confirms payment received."
            : "Please make payment by the due date. Thank you for your business."}
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
