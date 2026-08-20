import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableView } from "@/hooks/use-table-view";
import { SortableHead, TablePagination } from "@/components/table-controls";

export const Route = createFileRoute("/invoices/")({
  head: () => ({ meta: [{ title: "Invoices" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const { data: invoices = [], isLoading, error } = useQuery({ queryKey: ["invoices"], queryFn: () => api.listInvoices() });
  const filtered = invoices.filter((i) =>
    (!q || i.invoiceNumber.toLowerCase().includes(q.toLowerCase()) || i.customerName.toLowerCase().includes(q.toLowerCase()) || (i.storeName ?? "").toLowerCase().includes(q.toLowerCase())) &&
    (status === "all" || i.status === status)
  );

  const view = useTableView({
    data: filtered,
    accessors: {
      invoiceNumber: (i) => i.invoiceNumber,
      customerName: (i) => i.customerName,
      invoiceDate: (i) => i.invoiceDate,
      dueDate: (i) => i.dueDate,
      totalAmount: (i) => Number(i.totalAmount),
      amountPaid: (i) => Number(i.amountPaid),
      outstandingBalance: (i) => Number(i.outstandingBalance),
      status: (i) => i.status,
    },
    defaultSort: { key: "invoiceDate", dir: "desc" },
  });

  return (
    <AppShell
      title="Invoices"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by invoice # or customer" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Partially Paid">Partially Paid</SelectItem>
              <SelectItem value="Unpaid">Unpaid</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
              <SelectItem value="Credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead ctrl={view} sortKey="invoiceNumber">Invoice</SortableHead>
                  <SortableHead ctrl={view} sortKey="customerName">Customer</SortableHead>
                  <SortableHead ctrl={view} sortKey="invoiceDate">Date Issued</SortableHead>
                  <SortableHead ctrl={view} sortKey="dueDate">Due Date</SortableHead>
                  <SortableHead ctrl={view} sortKey="totalAmount" align="right">Total</SortableHead>
                  <SortableHead ctrl={view} sortKey="amountPaid" align="right">Amount Paid</SortableHead>
                  <SortableHead ctrl={view} sortKey="outstandingBalance" align="right">Balance</SortableHead>
                  <SortableHead ctrl={view} sortKey="status">Status</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 8 }).map((__, c) => (
                      <TableCell key={c}><Skeleton className="h-4 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!isLoading && error && (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-destructive">{error instanceof Error ? error.message : "Failed to load invoices"}</TableCell></TableRow>
                )}
                {!isLoading && !error && view.total === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No invoices match your filters.</TableCell></TableRow>
                )}
                {!isLoading && !error && view.paged.map((i) => (
                  <TableRow key={i.id} className={i.isVoided ? "opacity-60" : ""}>
                    <TableCell>
                      <Link to="/invoices/$id" params={{ id: i.id }} className={`font-medium hover:underline ${i.isVoided ? "line-through" : ""}`}>{i.invoiceNumber}</Link>
                    </TableCell>
                    <TableCell>
                      {i.customerName}
                      {i.storeName ? <span className="text-muted-foreground"> - {i.storeName}</span> : null}
                    </TableCell>
                    <TableCell>{formatDate(i.invoiceDate)}</TableCell>
                    <TableCell>{formatDate(i.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.totalAmount)}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(i.amountPaid)}</TableCell>
                    <TableCell className="text-right font-semibold text-earth">{formatCurrency(i.outstandingBalance)}</TableCell>
                    <TableCell>
                      {i.isVoided ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive" title={i.voidReason ?? ""}>Voided</Badge>
                      ) : (
                        <StatusBadge status={i.status} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination ctrl={view} label="invoices" />
        </CardContent>
      </Card>
    </AppShell>
  );
}
