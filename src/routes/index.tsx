import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BanknoteArrowUp, CalendarClock, CreditCard, FileText, TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";


export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard - Peaceful Acres" }] }),
  component: LandingPage,
});

const today = new Date();
const dueSoonWindowDays = 7;

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

  // Server-side MTD aggregates: invoice sales, delivered orders, expenses, profit.
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.getDashboardSummary(),
    refetchOnWindowFocus: true,
  });
  const expensesThisMonth = summary?.expenses ?? { purchases: 0, wages: 0, total: 0 };
  const deliveredOrdersMTD = summary?.sales.deliveredOrders ?? 0;


  const monthlySales = useMemo(() => groupMonthlySales(invoices), [invoices]);

  // Sales chart filters
  const now = new Date();
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [chartYear, setChartYear] = useState<number>(now.getFullYear() < 2026 ? 2026 : now.getFullYear());
  const [chartMonth, setChartMonth] = useState<number>(now.getMonth());

  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: api.listOrders });

  const chartData = useMemo(() => {
    type Point = { label: string; sales: number };
    const deliveredOrders = orders.filter((o) => o.status === "delivered");

    const addToBucket = (buckets: Map<string, Point>, key: string, label: string, amount: number) => {
      const existing = buckets.get(key);
      if (existing) existing.sales += amount;
      else buckets.set(key, { label, sales: amount });
    };

    if (chartPeriod === "year") {
      const buckets = new Map<string, Point>();
      for (let m = 0; m < 12; m++) {
        const key = String(m).padStart(2, "0");
        const label = new Date(chartYear, m, 1).toLocaleString("default", { month: "short" });
        buckets.set(key, { label, sales: 0 });
      }
      invoices.forEach((inv) => {
        const d = new Date(inv.invoiceDate);
        if (d.getFullYear() === chartYear) {
          addToBucket(buckets, String(d.getMonth()).padStart(2, "0"),
            d.toLocaleString("default", { month: "short" }), inv.totalAmount);
        }
      });
      deliveredOrders.forEach((o) => {
        const d = new Date(o.updatedAt || o.placedAt);
        if (d.getFullYear() === chartYear) {
          addToBucket(buckets, String(d.getMonth()).padStart(2, "0"),
            d.toLocaleString("default", { month: "short" }), Number(o.total || 0));
        }
      });
      return Array.from(buckets.values());
    }

    if (chartPeriod === "month") {
      const daysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
      const buckets = new Map<string, Point>();
      for (let day = 1; day <= daysInMonth; day++) {
        buckets.set(String(day), { label: String(day), sales: 0 });
      }
      invoices.forEach((inv) => {
        const d = new Date(inv.invoiceDate);
        if (d.getFullYear() === chartYear && d.getMonth() === chartMonth) {
          addToBucket(buckets, String(d.getDate()), String(d.getDate()), inv.totalAmount);
        }
      });
      deliveredOrders.forEach((o) => {
        const d = new Date(o.updatedAt || o.placedAt);
        if (d.getFullYear() === chartYear && d.getMonth() === chartMonth) {
          addToBucket(buckets, String(d.getDate()), String(d.getDate()), Number(o.total || 0));
        }
      });
      return Array.from(buckets.values());
    }

    // week: current week Mon..Sun
    const start = new Date(now);
    const dow = (start.getDay() + 6) % 7; // 0 = Mon
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const buckets = new Map<string, Point>();
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets.set(d.toDateString(), { label: dayLabels[i], sales: 0 });
    }
    invoices.forEach((inv) => {
      const d = new Date(inv.invoiceDate);
      if (d >= start && d < end) addToBucket(buckets, d.toDateString(),
        dayLabels[(d.getDay() + 6) % 7], inv.totalAmount);
    });
    deliveredOrders.forEach((o) => {
      const d = new Date(o.updatedAt || o.placedAt);
      if (d >= start && d < end) addToBucket(buckets, d.toDateString(),
        dayLabels[(d.getDay() + 6) % 7], Number(o.total || 0));
    });
    return Array.from(buckets.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, orders, chartPeriod, chartYear, chartMonth]);

  const chartTitle = chartPeriod === "year"
    ? `Sales · ${chartYear}`
    : chartPeriod === "month"
    ? `Sales · ${new Date(chartYear, chartMonth, 1).toLocaleString("default", { month: "long" })} ${chartYear}`
    : "Sales · This Week";

  const yearOptions: number[] = [];
  for (let y = 2026; y <= Math.max(now.getFullYear(), 2026); y++) yearOptions.push(y);
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(2026, i, 1).toLocaleString("default", { month: "long" }),
  }));

  const currentMonth = monthlySales[monthlySales.length - 1] ?? { month: "", sales: 0, receivables: 0 };
  const previousMonth = monthlySales[monthlySales.length - 2];
  const totalMonthSales = currentMonth.sales + deliveredOrdersMTD;
  const monthlyChange = previousMonth
    ? ((totalMonthSales - previousMonth.sales) / previousMonth.sales) * 100
    : 0;
  const monthlyProfit = totalMonthSales - expensesThisMonth.total;
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`${currentMonth.month || "This Month"} Sales`}
          value={formatCurrency(totalMonthSales)}
          icon={TrendingUp}
          tone="primary"
          trend={`Invoices ${formatCurrency(currentMonth.sales)} · Delivered orders ${formatCurrency(deliveredOrdersMTD)}`}
          trendDirection={monthlyChange >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Monthly Profits"
          value={formatCurrency(monthlyProfit)}
          icon={PiggyBank}
          tone={monthlyProfit >= 0 ? "success" : "destructive"}
          trend={`Sales ${formatCurrency(totalMonthSales)} − Expenses ${formatCurrency(expensesThisMonth.total)}`}
          trendDirection={monthlyProfit >= 0 ? "up" : "down"}
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
        <StatCard
          label="Expenses This Month"
          value={formatCurrency(expensesThisMonth.total)}
          icon={Wallet}
          tone="destructive"
          trend={`Purchases ${formatCurrency(expensesThisMonth.purchases)} · Wages ${formatCurrency(expensesThisMonth.wages)}`}
          trendDirection={expensesThisMonth.total > 0 ? "down" : "neutral"}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{chartTitle}</CardTitle>
              <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as "week" | "month" | "year")}>
                <TabsList>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="year">Year</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {chartPeriod !== "week" && (
              <div className="flex flex-wrap gap-2">
                {chartPeriod === "month" && (
                  <Select value={String(chartMonth)} onValueChange={(v) => setChartMonth(Number(v))}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={String(chartYear)} onValueChange={(v) => setChartYear(Number(v))}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
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
