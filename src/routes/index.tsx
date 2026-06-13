import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Download, Wallet, TrendingUp, Users, FileWarning, BanknoteArrowUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { customers, invoices, monthlySales, payments, sales, formatCurrency, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Peaceful Acres" }] }),
  component: Dashboard,
});

function Dashboard() {
  const totalSales = sales.reduce((s, x) => s + x.amount, 0);
  const outstanding = invoices.reduce((s, x) => s + x.outstandingBalance, 0);
  const paymentsReceived = payments.reduce((s, x) => s + x.amount, 0);
  const unpaidCount = invoices.filter((i) => i.status !== "Paid").length;
  const overdue = invoices.filter((i) => i.status === "Overdue");

  const topCustomers = [...customers]
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
    .slice(0, 5);

  return (
    <AppShell
      title="Dashboard"
      description="Overview of your farm's sales performance and outstanding receivables."
      actions={<Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Sales" value={formatCurrency(totalSales)} icon={TrendingUp} tone="primary" trend="+12.4% vs last month" trendDirection="up" />
        <StatCard label="Outstanding Receivables" value={formatCurrency(outstanding)} icon={Wallet} tone="warning" trend={`${unpaidCount} open invoices`} />
        <StatCard label="Payments Received" value={formatCurrency(paymentsReceived)} icon={BanknoteArrowUp} tone="success" trend="This month" trendDirection="up" />
        <StatCard label="Active Customers" value={String(customers.length)} icon={Users} tone="earth" />
        <StatCard label="Unpaid Invoices" value={String(unpaidCount)} icon={FileWarning} tone="destructive" trend={`${overdue.length} overdue`} trendDirection="down" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Sales</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Outstanding Receivables</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Bar dataKey="receivables" fill="var(--color-earth)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {sales.slice(0, 5).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.invoiceNumber}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{s.customerName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.amount)}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.slice(0, 5).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{p.customerName}</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{p.method}</span></TableCell>
                    <TableCell className="text-right font-medium text-success">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Customers by Outstanding</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topCustomers.map((c) => (
              <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.type}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-earth">{formatCurrency(c.outstandingBalance)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Overdue Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {overdue.length === 0 && <p className="text-sm text-muted-foreground">No overdue invoices. 🎉</p>}
            {overdue.map((i) => (
              <Link key={i.id} to="/invoices/$id" params={{ id: i.id }} className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.invoiceNumber} · {i.customerName}</p>
                  <p className="text-xs text-muted-foreground">Due {formatDate(i.dueDate)}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-destructive">{formatCurrency(i.outstandingBalance)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
