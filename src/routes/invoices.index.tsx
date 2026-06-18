import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — Peaceful Acres" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const { data: invoices = [], isLoading, error } = useQuery({ queryKey: ["invoices"], queryFn: api.listInvoices });
  const filtered = invoices.filter((i) =>
    (!q || i.invoiceNumber.toLowerCase().includes(q.toLowerCase()) || i.customerName.toLowerCase().includes(q.toLowerCase())) &&
    (status === "all" || i.status === status)
  );

  return (
    <AppShell title="Invoices" description="Track invoice payment status and outstanding balances.">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by invoice # or customer" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))}
                {!isLoading && error && (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-destructive">{error instanceof Error ? error.message : "Failed to load invoices"}</TableCell></TableRow>
                )}
                {!isLoading && !error && filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell><Link to="/invoices/$id" params={{ id: i.id }} className="font-medium hover:underline">{i.invoiceNumber}</Link></TableCell>
                    <TableCell>{i.customerName}</TableCell>
                    <TableCell>{formatDate(i.invoiceDate)}</TableCell>
                    <TableCell>{formatDate(i.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.totalAmount)}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(i.amountPaid)}</TableCell>
                    <TableCell className="text-right font-semibold text-earth">{formatCurrency(i.outstandingBalance)}</TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
