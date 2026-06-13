import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { sales, formatCurrency, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/sales/")({
  head: () => ({ meta: [{ title: "Sales — Peaceful Acres" }] }),
  component: SalesPage,
});

function SalesPage() {
  const [q, setQ] = useState("");
  const [pt, setPt] = useState("all");
  const filtered = sales.filter((s) =>
    (!q || s.invoiceNumber.toLowerCase().includes(q.toLowerCase()) || s.customerName.toLowerCase().includes(q.toLowerCase())) &&
    (pt === "all" || s.paymentType === pt)
  );

  return (
    <AppShell
      title="Sales"
      description="All recorded sales with linked invoices."
      actions={<Button asChild><Link to="/sales/new"><Plus className="mr-2 h-4 w-4" />New Sale</Link></Button>}
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by invoice or customer" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={pt} onValueChange={setPt}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Types</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Link to="/invoices/$id" params={{ id: s.id }} className="font-medium hover:underline">{s.invoiceNumber}</Link></TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>{formatDate(s.date)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(s.amount)}</TableCell>
                    <TableCell><Badge variant="outline">{s.paymentType}</Badge></TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
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
