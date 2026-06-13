import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Wallet, AlertTriangle, CalendarClock, Users } from "lucide-react";
import { invoices, formatCurrency, formatDate, daysOverdue } from "@/lib/mock-data";

export const Route = createFileRoute("/receivables")({
  head: () => ({ meta: [{ title: "Receivables — GreenHarvest" }] }),
  component: ReceivablesPage,
});

function ReceivablesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("balance");

  const open = invoices.filter((i) => i.outstandingBalance > 0);
  const totalOutstanding = open.reduce((s, i) => s + i.outstandingBalance, 0);
  const overdue = open.filter((i) => i.status === "Overdue");
  const totalOverdue = overdue.reduce((s, i) => s + i.outstandingBalance, 0);
  const now = new Date("2026-06-13").getTime();
  const dueThisWeek = open.filter((i) => {
    const d = new Date(i.dueDate).getTime();
    return d >= now && d - now <= 7 * 86400000;
  });
  const debtors = new Set(open.map((i) => i.customerId)).size;

  const filtered = useMemo(() => {
    let list = open.filter((i) =>
      (!q || i.invoiceNumber.toLowerCase().includes(q.toLowerCase()) || i.customerName.toLowerCase().includes(q.toLowerCase())) &&
      (status === "all" || i.status === status)
    );
    if (sort === "balance") list = [...list].sort((a, b) => b.outstandingBalance - a.outstandingBalance);
    if (sort === "due") list = [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return list;
  }, [q, status, sort, open]);

  return (
    <AppShell title="Accounts Receivable" description="Outstanding balances owed to your farm.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={Wallet} tone="earth" />
        <StatCard label="Overdue" value={formatCurrency(totalOverdue)} icon={AlertTriangle} tone="destructive" trend={`${overdue.length} invoices`} />
        <StatCard label="Due This Week" value={formatCurrency(dueThisWeek.reduce((s, i) => s + i.outstandingBalance, 0))} icon={CalendarClock} tone="warning" />
        <StatCard label="Debtors" value={String(debtors)} icon={Users} tone="primary" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="balance">Sort: Balance Due</SelectItem>
                <SelectItem value="due">Sort: Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice #</TableHead><TableHead className="text-right">Original</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Days Overdue</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No outstanding receivables.</TableCell></TableRow>}
                {filtered.map((i) => {
                  const od = daysOverdue(i.dueDate);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.customerName}</TableCell>
                      <TableCell><Link to="/invoices/$id" params={{ id: i.id }} className="hover:underline">{i.invoiceNumber}</Link></TableCell>
                      <TableCell className="text-right">{formatCurrency(i.totalAmount)}</TableCell>
                      <TableCell className="text-right text-success">{formatCurrency(i.amountPaid)}</TableCell>
                      <TableCell className="text-right font-semibold text-earth">{formatCurrency(i.outstandingBalance)}</TableCell>
                      <TableCell>{formatDate(i.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        {od > 0 ? <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">{od} days</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" asChild><Link to="/payments/new">Record</Link></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
