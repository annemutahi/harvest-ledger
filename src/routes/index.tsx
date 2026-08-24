import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BanknoteArrowUp, CalendarClock, CreditCard, PackageCheck, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Peaceful Acres Farm ERP" },
      { name: "description", content: "Month-to-date sales, cash collected, expenses and outstanding receivables for Peaceful Acres Farm." },
      { property: "og:title", content: "Dashboard · Peaceful Acres Farm ERP" },
      { property: "og:description", content: "Month-to-date sales, cash collected, expenses and outstanding receivables." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

const today = new Date();
const dueSoonWindowDays = 7;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function daysUntil(date: string) {
  const due = new Date(date);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function pctChange(current: number, previous: number): string {
  if (!previous) return "No prior-month figure";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(0)}% vs last month (${formatCurrency(previous)})`;
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
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: async () => (await api.listInvoices()).filter((i) => !i.isVoided) });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: async () => (await api.listPayments()).filter((p) => !p.isVoided) });
  const { data: stockEntries = [] } = useQuery({ queryKey: ["stock-entries"], queryFn: () => api.listStockEntries() });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // Server-side MTD aggregates: invoice sales, delivered orders, expenses, profit.
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.getDashboardSummary(),
    refetchOnWindowFocus: true,
  });
  const { data: prevSummary } = useQuery({
    queryKey: ["dashboard-summary", iso(prevStart), iso(prevEnd)],
    queryFn: () => api.getDashboardSummary({ from: iso(prevStart), to: iso(prevEnd) }),
  });
  const expensesThisMonth = summary?.expenses ?? {
    purchases: 0,
    wages: 0,
    total: 0,
    purchasesPaid: 0,
    wagesPaid: 0,
    paidTotal: 0,
  };
  const deliveredOrdersMTD = summary?.sales.deliveredOrders ?? 0;



  const monthlySales = useMemo(() => groupMonthlySales(invoices), [invoices]);

  // Sales chart filters
  const now = new Date();
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [chartYear, setChartYear] = useState<number>(now.getFullYear() < 2026 ? 2026 : now.getFullYear());
  const [chartMonth, setChartMonth] = useState<number>(now.getMonth());
  const [chartMetric, setChartMetric] = useState<"sales" | "collected" | "both">("both");

  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => api.listOrders() });

  const chartData = useMemo(() => {
    type Point = { label: string; sales: number; collected: number };
    const deliveredOrders = orders.filter((o) => o.status === "delivered");

    const addToBucket = (
      buckets: Map<string, Point>,
      key: string,
      label: string,
      amount: number,
      field: "sales" | "collected" = "sales",
    ) => {
      const existing = buckets.get(key);
      if (existing) existing[field] += amount;
      else buckets.set(key, { label, sales: 0, collected: 0, [field]: amount } as Point);
    };

    if (chartPeriod === "year") {
      const buckets = new Map<string, Point>();
      for (let m = 0; m < 12; m++) {
        const key = String(m).padStart(2, "0");
        const label = new Date(chartYear, m, 1).toLocaleString("default", { month: "short" });
        buckets.set(key, { label, sales: 0, collected: 0 });
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
      payments.forEach((p) => {
        const d = new Date(p.date);
        if (d.getFullYear() === chartYear) {
          addToBucket(buckets, String(d.getMonth()).padStart(2, "0"),
            d.toLocaleString("default", { month: "short" }), p.amount, "collected");
        }
      });
      return Array.from(buckets.values());
    }

    if (chartPeriod === "month") {
      const daysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
      const buckets = new Map<string, Point>();
      for (let day = 1; day <= daysInMonth; day++) {
        buckets.set(String(day), { label: String(day), sales: 0, collected: 0 });
      }
      const inMonth = (d: Date) => d.getFullYear() === chartYear && d.getMonth() === chartMonth;
      invoices.forEach((inv) => {
        const d = new Date(inv.invoiceDate);
        if (inMonth(d)) addToBucket(buckets, String(d.getDate()), String(d.getDate()), inv.totalAmount);
      });
      deliveredOrders.forEach((o) => {
        const d = new Date(o.updatedAt || o.placedAt);
        if (inMonth(d)) addToBucket(buckets, String(d.getDate()), String(d.getDate()), Number(o.total || 0));
      });
      payments.forEach((p) => {
        const d = new Date(p.date);
        if (inMonth(d)) addToBucket(buckets, String(d.getDate()), String(d.getDate()), p.amount, "collected");
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
      buckets.set(d.toDateString(), { label: dayLabels[i], sales: 0, collected: 0 });
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
    payments.forEach((p) => {
      const d = new Date(p.date);
      if (d >= start && d < end) addToBucket(buckets, d.toDateString(),
        dayLabels[(d.getDay() + 6) % 7], p.amount, "collected");
    });
    return Array.from(buckets.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, orders, payments, chartPeriod, chartYear, chartMonth]);


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

  const monthLabel = today.toLocaleString("default", { month: "long" });
  const totalMonthSales = summary?.sales.total ?? 0;
  const prevMonthSales = prevSummary?.sales.total ?? 0;

  const inThisMonth = (d: string) => {
    const date = new Date(d);
    return date >= monthStart && date <= today;
  };
  const inPrevMonth = (d: string) => {
    const date = new Date(d);
    return date >= prevStart && date <= prevEnd;
  };
  const collectedMTD = payments.filter((p) => inThisMonth(p.date)).reduce((s, p) => s + p.amount, 0);
  const collectedPrev = payments.filter((p) => inPrevMonth(p.date)).reduce((s, p) => s + p.amount, 0);

  const paidExpensesMTD = expensesThisMonth.paidTotal;
  const prevPaidExpenses = prevSummary?.expenses.paidTotal ?? 0;
  const cashProfit = collectedMTD - paidExpensesMTD;
  const prevCashProfit = collectedPrev - prevPaidExpenses;

  const openInvoices = invoices.filter((invoice) => invoice.outstandingBalance > 0);
  const receivables = openInvoices.reduce((s, i) => s + i.outstandingBalance, 0);
  const overdue = openInvoices
    .map((invoice) => ({ ...invoice, daysUntilDue: daysUntil(invoice.dueDate) }))
    .filter((invoice) => invoice.daysUntilDue < 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const overdueTotal = overdue.reduce((s, i) => s + i.outstandingBalance, 0);
  const totalCredit = invoices.reduce((sum, invoice) => sum + invoice.availableCredit, 0);
  const dueSoon = openInvoices
    .map((invoice) => ({ ...invoice, daysUntilDue: daysUntil(invoice.dueDate) }))
    .filter((invoice) => invoice.daysUntilDue >= 0 && invoice.daysUntilDue <= dueSoonWindowDays)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const pendingStock = stockEntries.filter((s) => s.status === "pending");

  return (
    <AppShell
      showSearch
      title="Dashboard"
      description=""
      actions={
        <Button asChild>
          <Link to="/transactions">Open Transactions</Link>
        </Button>
      }
    >
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">
          {monthLabel} so far · 1–{today.getDate()} {monthLabel}
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sales invoiced"
            value={formatCurrency(totalMonthSales)}
            icon={TrendingUp}
            tone="primary"
            trend={pctChange(totalMonthSales, prevMonthSales)}
            trendDirection={totalMonthSales >= prevMonthSales ? "up" : "down"}
          />
          <StatCard
            label="Cash collected"
            value={formatCurrency(collectedMTD)}
            icon={BanknoteArrowUp}
            tone="success"
            trend={pctChange(collectedMTD, collectedPrev)}
            trendDirection={collectedMTD >= collectedPrev ? "up" : "down"}
          />
          <StatCard
            label="Expenses paid"
            value={formatCurrency(paidExpensesMTD)}
            icon={Wallet}
            tone="destructive"
            trendDirection="neutral"
          />
          <StatCard
            label="Net cash profit"
            value={formatCurrency(cashProfit)}
            icon={PiggyBank}
            tone={cashProfit >= 0 ? "success" : "destructive"}
            trend={`Cash collected − expenses paid`}
            trendDirection={cashProfit >= prevCashProfit ? "up" : "down"}
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Owed to us (receivables)"
            value={formatCurrency(receivables)}
            icon={CalendarClock}
            tone="warning"
            trend={`${openInvoices.length} open invoices`}
          />
          <StatCard
            label="Overdue"
            value={formatCurrency(overdueTotal)}
            icon={AlertTriangle}
            tone="destructive"
            trend={`${overdue.length} invoices past due date`}
            trendDirection={overdueTotal > 0 ? "down" : "neutral"}
          />
          <StatCard
            label="Customer credit held"
            value={formatCurrency(totalCredit)}
            icon={CreditCard}
            tone="earth"
            trend="Owed to customers"
          />
        </div>
      </section>


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
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={chartMetric} onValueChange={(v) => setChartMetric(v as "sales" | "collected" | "both")}>
                <TabsList>
                  <TabsTrigger value="sales">Invoiced</TabsTrigger>
                  <TabsTrigger value="collected">Cash collected</TabsTrigger>
                  <TabsTrigger value="both">Both</TabsTrigger>
                </TabsList>
              </Tabs>
              {chartPeriod !== "week" && (
                <>
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
                </>
              )}
            </div>
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
                {chartMetric !== "collected" && (
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Invoiced sales"
                    stroke="var(--color-collected)"
                    strokeWidth={2}
                    fill="var(--color-collected)"
                    fillOpacity={0.18}
                  />
                )}
                {chartMetric !== "sales" && (
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Cash collected"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    fill="var(--color-success)"
                    fillOpacity={0.14}
                  />
                )}
                {chartMetric === "both" && <Legend />}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>



        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {overdue.map((invoice) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link to="/invoices/$id" params={{ id: invoice.id }} className="font-medium hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="mt-1 truncate text-xs text-destructive">
                      {invoice.customerName} · {Math.abs(invoice.daysUntilDue)} days overdue
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-destructive">{formatCurrency(invoice.outstandingBalance)}</span>
                </li>
              ))}
              {dueSoon.map((invoice) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link to="/invoices/$id" params={{ id: invoice.id }} className="font-medium hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {invoice.customerName} · due {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-earth">{formatCurrency(invoice.outstandingBalance)}</span>
                </li>
              ))}
              {pendingStock.length > 0 && (
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <PackageCheck className="h-4 w-4 shrink-0 text-warning-foreground" />
                    <Link to="/stock" className="font-medium hover:underline">
                      {pendingStock.length} stock {pendingStock.length === 1 ? "entry" : "entries"} awaiting approval
                    </Link>
                  </div>
                </li>
              )}
              {overdue.length === 0 && dueSoon.length === 0 && pendingStock.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing needs attention right now.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

