import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { payments, formatCurrency, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/payments/")({
  head: () => ({ meta: [{ title: "Payments — Peaceful Acres" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const [q, setQ] = useState("");
  const filtered = payments.filter((p) => !q || p.customerName.toLowerCase().includes(q.toLowerCase()) || p.invoiceNumber.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell
      title="Payments"
      description="All payments received from customers."
      actions={<Button asChild><Link to="/payments/new"><Plus className="mr-2 h-4 w-4" />Record Payment</Link></Button>}
    >
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by customer or invoice" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="font-medium">{p.customerName}</TableCell>
                    <TableCell><Link to="/invoices/$id" params={{ id: p.invoiceId }} className="hover:underline">{p.invoiceNumber}</Link></TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{formatCurrency(p.amount)}</TableCell>
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
