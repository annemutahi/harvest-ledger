import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { BanknoteArrowUp, CalendarClock, CreditCard, FileText, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard - Peaceful Acres" }] }),
  component: LandingPage,
});

const today = new Date();
const dueSoonWindowDays = 14;

function daysUntil(date: string) {
  const due = new Date(date);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function groupMonthlySales(invoices: Array<{ invoiceDate: string; totalAmount: number; outstandingBalance: number }>) {
  const groups = new Map<string, { key: string; month: string; sales: number; receivables: number }>();

  invoices.forEach((invoice) => {
    const date = new Date(invoice.invoiceDate);
    if (Number.isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleString("default", { month: "short" });
    const existing = groups.get(key);

    if (existing) {
      existing.sales += invoice.totalAmount;
      existing.receivables += invoice.outstandingBalance;
    } else {
      groups.set(key, {
        key,
        month: `${monthLabel} ${year}`,
        sales: invoice.totalAmount,
        receivables: invoice.outstandingBalance,
      });
    }
  });

  return Array.from(groups.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6)
    .map(({ month, sales, receivables }) => ({ month, sales, receivables }));
}

function LandingPage() {
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: api.listInvoices });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: api.listPayments });

  const monthlySales = useMemo(() => groupMonthlySales(invoices), [invoices]);
  const currentMonth = monthlySales[monthlySales.length - 1] ?? { month: "", sales: 0, receivables: 0 };
  const previousMonth = monthlySales[monthlySales.length - 2];
  const monthlyChange = previousMonth
    ? ((currentMonth.sales - previousMonth.sales) / previousMonth.sales) * 100
    : 0;
  const paymentsReceived = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalCredit = invoices.reduce((sum, invoice) => sum + invoice.outstandingBalance, 0);
  const dueSoon = invoices
    .filter((invoice) => invoice.outstandingBalance > 0)
    .map((invoice) => ({ ...invoice, daysUntilDue: daysUntil(invoice.dueDate) }))
    .filter((invoice) => invoice.daysUntilDue >= 0 && invoice.daysUntilDue <= dueSoonWindowDays)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const dueSoonTotal = dueSoon.reduce((sum, invoice) => sum + invoice.outstandingBalance, 0);

  return (
    <AppShell
      title="Dashboard"
      description=""
      actions={
        <Button asChild>
          <Link to="/transactions">Open Transactions</Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`${currentMonth.month} Sales`}
          value={formatCurrency(currentMonth.sales)}
          icon={TrendingUp}
          tone="primary"
          trend={`${monthlyChange >= 0 ? "+" : ""}${monthlyChange.toFixed(1)}% vs ${previousMonth?.month ?? "N/A"}`}
          trendDirection={monthlyChange >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Payments"
          value={formatCurrency(paymentsReceived)}
          icon={BanknoteArrowUp}
          tone="success"
          trend={`${payments.length} payments recorded`}
          trendDirection="up"
        />
        <StatCard
          label="Total Credit"
          value={formatCurrency(totalCredit)}
          icon={CreditCard}
          tone="earth"
          trend="Outstanding customer balance"
        />
        <StatCard
          label="Payments Due Soon"
          value={formatCurrency(dueSoonTotal)}
          icon={CalendarClock}
          tone="warning"
          trend={`${dueSoon.length} invoices due in ${dueSoonWindowDays} days`}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Summary</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickFormatter={(value) => `${Number(value) / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="var(--color-primary)"
                  fillOpacity={0.18}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments Due Soon</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueSoon.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link to="/invoices/$id" params={{ id: invoice.id }} className="font-medium hover:underline">
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{invoice.customerName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{formatDate(invoice.dueDate)}</span>
                        <StatusBadge status={invoice.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-earth">
                      {formatCurrency(invoice.outstandingBalance)}
                    </TableCell>
                  </TableRow>
                ))}
                {dueSoon.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                      No payments due soon.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Open Invoices</p>
              <p className="text-2xl font-bold">{invoices.filter((invoice) => invoice.outstandingBalance > 0).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <BanknoteArrowUp className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium">Latest Payment</p>
              <p className="text-2xl font-bold">{formatCurrency(payments[0]?.amount ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CalendarClock className="h-5 w-5 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium">Next Due</p>
              <p className="text-2xl font-bold">{dueSoon[0] ? formatDate(dueSoon[0].dueDate) : "None"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
