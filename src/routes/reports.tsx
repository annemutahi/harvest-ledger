import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Wallet,
  PiggyBank,
  Boxes,
  Users,
  HardHat,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { api } from "@/lib/api";
import { useTableView } from "@/hooks/use-table-view";
import { SortableHead, TablePagination } from "@/components/table-controls";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Peaceful Acres" }] }),
  component: ReportsPage,
});

type Period = { from: string; to: string; label: string };

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function computePeriod(year: number, month: number | "all"): Period {
  if (month === "all") {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Year ${year}` };
  }
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
    label: `${MONTHS[month]} ${year}`,
  };
}

function inRange(d: string, from: string, to: string) {
  if (!d) return false;
  const s = d.slice(0, 10);
  return s >= from && s <= to;
}

const CHART_COLORS = ["#0f766e", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f97316", "#ec4899"];

function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth());
  const period = useMemo(() => computePeriod(year, month), [year, month]);

  const range = { from: period.from, to: period.to };
  const invoicesQ = useQuery({ queryKey: ["invoices", range], queryFn: () => api.listInvoices(range) });
  const salesQ = useQuery({ queryKey: ["sales", range], queryFn: () => api.listSales(range) });
  const paymentsQ = useQuery({ queryKey: ["payments", range], queryFn: () => api.listPayments(range) });
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const productsQ = useQuery({ queryKey: ["products"], queryFn: api.listProducts });
  const purchasesQ = useQuery({ queryKey: ["purchases", range], queryFn: () => api.listPurchases(range) });
  const wagesQ = useQuery({ queryKey: ["casual-wages", range], queryFn: () => api.listCasualWages(range) });
  const workersQ = useQuery({ queryKey: ["casual-workers"], queryFn: api.listCasualWorkers });
  const stockQ = useQuery({ queryKey: ["stock", range], queryFn: () => api.listStockEntries(range) });
  const ordersQ = useQuery({ queryKey: ["orders", range], queryFn: () => api.listOrders(range) });

  const loading =
    invoicesQ.isLoading || salesQ.isLoading || paymentsQ.isLoading || customersQ.isLoading ||
    productsQ.isLoading || purchasesQ.isLoading || wagesQ.isLoading || workersQ.isLoading ||
    stockQ.isLoading || ordersQ.isLoading;

  const yearOptions = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    invoicesQ.data?.forEach((i) => i.invoiceDate && years.add(new Date(i.invoiceDate).getFullYear()));
    salesQ.data?.forEach((s) => s.date && years.add(new Date(s.date).getFullYear()));
    purchasesQ.data?.forEach((p) => p.date && years.add(new Date(p.date).getFullYear()));
    return Array.from(years).filter((y) => !Number.isNaN(y) && y >= 2020 && y <= 2100).sort((a, b) => b - a);
  }, [invoicesQ.data, salesQ.data, purchasesQ.data, now]);

  // ---------- Sales ----------
  const salesData = useMemo(() => {
    const sales = (salesQ.data ?? []).filter((s) => inRange(s.date, period.from, period.to));
    const invoices = (invoicesQ.data ?? []).filter((i) => inRange(i.invoiceDate, period.from, period.to));
    const totalSales = sales.reduce((a, s) => a + s.amount, 0);
    let qty = 0;
    const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
    const byCustomer = new Map<string, { name: string; count: number; revenue: number }>();
    sales.forEach((s) => {
      s.items.forEach((it) => {
        qty += it.quantity;
        const p = byProduct.get(it.productName) ?? { name: it.productName, qty: 0, revenue: 0 };
        p.qty += it.quantity;
        p.revenue += it.total;
        byProduct.set(it.productName, p);
      });
      const c = byCustomer.get(s.customerName || "Walk-in") ?? { name: s.customerName || "Walk-in", count: 0, revenue: 0 };
      c.count += 1;
      c.revenue += s.amount;
      byCustomer.set(s.customerName || "Walk-in", c);
    });

    // Trend: if month=all => monthly, else daily
    const trend: { label: string; sales: number }[] = [];
    if (month === "all") {
      const buckets = new Array(12).fill(0);
      sales.forEach((s) => {
        const d = new Date(s.date);
        if (d.getFullYear() === year) buckets[d.getMonth()] += s.amount;
      });
      buckets.forEach((v, i) => trend.push({ label: MONTHS[i].slice(0, 3), sales: v }));
    } else {
      const days = new Date(year, month + 1, 0).getDate();
      const buckets = new Array(days).fill(0);
      sales.forEach((s) => {
        const d = new Date(s.date);
        if (d.getFullYear() === year && d.getMonth() === month) buckets[d.getDate() - 1] += s.amount;
      });
      buckets.forEach((v, i) => trend.push({ label: String(i + 1), sales: v }));
    }
    return {
      sales, invoices, totalSales, qty, orders: sales.length,
      byProduct: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue),
      byCustomer: Array.from(byCustomer.values()).sort((a, b) => b.revenue - a.revenue),
      trend,
    };
  }, [salesQ.data, invoicesQ.data, period, month, year]);

  // ---------- Expenses ----------
  const expenseData = useMemo(() => {
    const purchases = (purchasesQ.data ?? []).filter((p) => inRange(p.date, period.from, period.to));
    const wages = (wagesQ.data ?? []).filter((w) => inRange(w.date, period.from, period.to));
    const purchasesTotal = purchases.reduce((a, p) => a + p.total, 0);
    const wagesTotal = wages.reduce((a, w) => a + w.total, 0);
    const total = purchasesTotal + wagesTotal;
    const byCategory = new Map<string, number>();
    purchases.forEach((p) => byCategory.set(p.category || "Uncategorised", (byCategory.get(p.category || "Uncategorised") ?? 0) + p.total));
    byCategory.set("Casual Wages", (byCategory.get("Casual Wages") ?? 0) + wagesTotal);
    const categories = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const trend: { label: string; purchases: number; wages: number }[] = [];
    if (month === "all") {
      const p = new Array(12).fill(0), w = new Array(12).fill(0);
      purchases.forEach((x) => { const d = new Date(x.date); if (d.getFullYear() === year) p[d.getMonth()] += x.total; });
      wages.forEach((x) => { const d = new Date(x.date); if (d.getFullYear() === year) w[d.getMonth()] += x.total; });
      for (let i = 0; i < 12; i++) trend.push({ label: MONTHS[i].slice(0, 3), purchases: p[i], wages: w[i] });
    } else {
      const days = new Date(year, month + 1, 0).getDate();
      const p = new Array(days).fill(0), w = new Array(days).fill(0);
      purchases.forEach((x) => { const d = new Date(x.date); if (d.getFullYear() === year && d.getMonth() === month) p[d.getDate() - 1] += x.total; });
      wages.forEach((x) => { const d = new Date(x.date); if (d.getFullYear() === year && d.getMonth() === month) w[d.getDate() - 1] += x.total; });
      for (let i = 0; i < days; i++) trend.push({ label: String(i + 1), purchases: p[i], wages: w[i] });
    }
    return { purchases, wages, purchasesTotal, wagesTotal, total, categories, trend };
  }, [purchasesQ.data, wagesQ.data, period, month, year]);

  // ---------- P&L ----------
  const pnl = useMemo(() => {
    const revenue = salesData.totalSales;
    const expenses = expenseData.total;
    const net = revenue - expenses;
    const margin = revenue > 0 ? (net / revenue) * 100 : 0;
    const comparison = [
      { name: "Revenue", value: revenue },
      { name: "Expenses", value: expenses },
      { name: "Net", value: net },
    ];
    // Monthly comparison series for the year
    const buckets: { label: string; revenue: number; expenses: number; net: number }[] = [];
    if (month === "all") {
      const r = new Array(12).fill(0), e = new Array(12).fill(0);
      salesData.sales.forEach((s) => { const d = new Date(s.date); if (d.getFullYear() === year) r[d.getMonth()] += s.amount; });
      expenseData.purchases.forEach((x) => { const d = new Date(x.date); if (d.getFullYear() === year) e[d.getMonth()] += x.total; });
      expenseData.wages.forEach((x) => { const d = new Date(x.date); if (d.getFullYear() === year) e[d.getMonth()] += x.total; });
      for (let i = 0; i < 12; i++) buckets.push({ label: MONTHS[i].slice(0, 3), revenue: r[i], expenses: e[i], net: r[i] - e[i] });
    } else {
      buckets.push({ label: "Revenue", revenue, expenses: 0, net: 0 });
      buckets.push({ label: "Expenses", revenue: 0, expenses, net: 0 });
      buckets.push({ label: "Net", revenue: 0, expenses: 0, net });
    }
    return { revenue, expenses, net, margin, comparison, buckets };
  }, [salesData, expenseData, month, year]);

  // ---------- Inventory ----------
  const inventory = useMemo(() => {
    const products = productsQ.data ?? [];
    const stockEntries = (stockQ.data ?? []).filter((e) => inRange(e.recordedAt, period.from, period.to));
    const received = stockEntries
      .filter((e) => e.status === "approved" || e.status === "matched")
      .reduce((a, e) => a + e.quantity, 0);
    let sold = 0;
    salesData.sales.forEach((s) => s.items.forEach((it) => (sold += it.quantity)));
    const lowStock = products.filter((p) => p.availableQuantity > 0 && p.availableQuantity < 20);
    const outOfStock = products.filter((p) => p.availableQuantity <= 0);
    const totalUnits = products.reduce((a, p) => a + p.availableQuantity, 0);
    const inventoryValue = products.reduce((a, p) => a + p.availableQuantity * p.unitPrice, 0);
    return { products, stockEntries, received, sold, lowStock, outOfStock, totalUnits, inventoryValue };
  }, [productsQ.data, stockQ.data, salesData.sales, period]);

  // ---------- Casual workers ----------
  const casual = useMemo(() => {
    const workers = workersQ.data ?? [];
    const wages = (wagesQ.data ?? []).filter((w) => inRange(w.date, period.from, period.to));
    const paid = wages.filter((w) => w.paid);
    const unpaid = wages.filter((w) => !w.paid);
    const wagesDue = wages.reduce((a, w) => a + w.total, 0);
    const wagesPaid = paid.reduce((a, w) => a + w.total, 0);
    const wagesUnpaid = unpaid.reduce((a, w) => a + w.total, 0);
    const byWorker = new Map<string, { name: string; days: number; total: number; paid: number; unpaid: number }>();
    wages.forEach((w) => {
      const key = w.workerName || "Unknown";
      const cur = byWorker.get(key) ?? { name: key, days: 0, total: 0, paid: 0, unpaid: 0 };
      cur.days += w.daysWorked;
      cur.total += w.total;
      if (w.paid) cur.paid += w.total; else cur.unpaid += w.total;
      byWorker.set(key, cur);
    });
    return {
      workers, wages,
      wagesDue, wagesPaid, wagesUnpaid,
      activeWorkers: workers.filter((w) => w.active).length,
      byWorker: Array.from(byWorker.values()).sort((a, b) => b.total - a.total),
    };
  }, [workersQ.data, wagesQ.data, period]);

  // ---------- Customers ----------
  const customerReport = useMemo(() => {
    const customers = customersQ.data ?? [];
    const salesByCustomer = new Map<string, { id: string; name: string; orders: number; revenue: number; lastPurchase: string }>();
    salesData.sales.forEach((s) => {
      const key = s.customerId || s.customerName;
      const cur = salesByCustomer.get(key) ?? { id: s.customerId, name: s.customerName || "Walk-in", orders: 0, revenue: 0, lastPurchase: "" };
      cur.orders += 1;
      cur.revenue += s.amount;
      if (!cur.lastPurchase || s.date > cur.lastPurchase) cur.lastPurchase = s.date;
      salesByCustomer.set(key, cur);
    });
    const rows = customers.map((c) => {
      const activity = salesByCustomer.get(c.id);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        orders: activity?.orders ?? 0,
        revenue: activity?.revenue ?? 0,
        lastPurchase: activity?.lastPurchase ?? "",
        outstanding: c.outstandingBalance,
      };
    });
    const active = rows.filter((r) => r.orders > 0);
    const inactive = rows.filter((r) => r.orders === 0);
    const top = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    return { rows, total: customers.length, active: active.length, inactive: inactive.length, top };
  }, [customersQ.data, salesData.sales]);

  const handlePrint = () => window.print();

  return (
    <AppShell
      title="Reports & Analytics"
      description={`Business insights for ${period.label}`}
      actions={
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      }
    >

      <div className="print-document">
        <Card className="print:hidden">
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(v === "all" ? "all" : Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Whole year</SelectItem>
                    {MONTHS.map((m, i) => (<SelectItem key={m} value={String(i)}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Year</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(period.from)} <ArrowRight className="inline h-3 w-3" /> {formatDate(period.to)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="sales" className="mt-6">
          <TabsList className="flex flex-wrap print:hidden">
            <TabsTrigger value="sales"><BarChart3 className="mr-2 h-4 w-4" />Sales</TabsTrigger>
            <TabsTrigger value="expenses"><Wallet className="mr-2 h-4 w-4" />Expenses</TabsTrigger>
            <TabsTrigger value="pnl"><PiggyBank className="mr-2 h-4 w-4" />Profit & Loss</TabsTrigger>
            <TabsTrigger value="inventory"><Boxes className="mr-2 h-4 w-4" />Inventory</TabsTrigger>
            <TabsTrigger value="casuals"><HardHat className="mr-2 h-4 w-4" />Casual Workers</TabsTrigger>
            <TabsTrigger value="customers"><Users className="mr-2 h-4 w-4" />Customers</TabsTrigger>
          </TabsList>

          {loading ? <LoadingBlock /> : (
            <>
              <TabsContent value="sales"><SalesReport data={salesData} period={period} /></TabsContent>
              <TabsContent value="expenses"><ExpensesReport data={expenseData} period={period} /></TabsContent>
              <TabsContent value="pnl"><PnlReport data={pnl} monthMode={month === "all"} period={period} /></TabsContent>
              <TabsContent value="inventory"><InventoryReport data={inventory} period={period} /></TabsContent>
              <TabsContent value="casuals"><CasualsReport data={casual} period={period} /></TabsContent>
              <TabsContent value="customers"><CustomersReport data={customerReport} period={period} /></TabsContent>
            </>
          )}

        </Tabs>
      </div>
    </AppShell>
  );
}

function LoadingBlock() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      <Skeleton className="col-span-full h-72" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{label}</p>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-80 pr-2">{children}</CardContent>
    </Card>
  );
}

function exportSheet(filenameBase: string, sheetName: string, rows: Record<string, unknown>[], period: Period) {
  const wb = XLSX.utils.book_new();
  const meta = [["Report", sheetName], ["Period", period.label], ["From", period.from], ["To", period.to], ["Generated", new Date().toISOString()]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Overview");
  XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["No data"]]), sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filenameBase}-${period.from}_${period.to}.xlsx`);
}

function TableCardHeader({ title, onExport }: { title: string; onExport: () => void }) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
      <CardTitle className="text-base">{title}</CardTitle>
      <Button variant="outline" size="sm" onClick={onExport} className="print:hidden">
        <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Export Excel
      </Button>
    </CardHeader>
  );
}


/* ---------------- Sales ---------------- */
function SalesReport({ data, period }: { data: SalesDataShape; period: Period }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Sales" value={formatCurrency(data.totalSales)} icon={BarChart3} tone="primary" />
        <StatCard label="Orders" value={String(data.orders)} icon={TrendingUp} tone="earth" />
        <StatCard label="Units Sold" value={String(data.qty)} icon={Boxes} tone="success" />
        <StatCard label="Avg Order Value" value={formatCurrency(data.orders ? data.totalSales / data.orders : 0)} icon={PiggyBank} tone="warning" />
      </div>

      <Card>
        <TableCardHeader
          title="Sales Trend"
          onExport={() => exportSheet("sales-trend", "Sales Trend", data.trend.map((t) => ({ Period: t.label, Sales: t.sales })), period)}
        />
        <CardContent className="h-80 pr-2">
          {data.trend.length === 0 ? <EmptyState label="No sales in this period" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="sales" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <TableCardHeader
          title="All Sales"
          onExport={() => exportSheet("sales", "Sales", data.sales.map((s: any) => ({
            Date: s.date, Invoice: s.invoiceNumber, Customer: s.customerName, Amount: s.amount, Status: s.status, PaymentType: s.paymentType,
          })), period)}
        />
        <CardContent>
          {data.sales.length === 0 ? <EmptyState label="No sales in this period" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.sales.slice(0, 15).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.date)}</TableCell>
                    <TableCell>{s.invoiceNumber ?? "—"}</TableCell>
                    <TableCell>{s.customerName ?? "Walk-in"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(s.amount)}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <TableCardHeader
            title="Top Products"
            onExport={() => exportSheet("sales-by-product", "Sales by Product", data.byProduct.map((p) => ({ Product: p.name, Quantity: p.qty, Revenue: p.revenue })), period)}
          />
          <CardContent>
            {data.byProduct.length === 0 ? <EmptyState label="No product sales" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.byProduct.slice(0, 10).map((p) => (
                    <TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell className="text-right tabular-nums">{p.qty}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(p.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <TableCardHeader
            title="Top Customers"
            onExport={() => exportSheet("sales-by-customer", "Sales by Customer", data.byCustomer.map((c) => ({ Customer: c.name, Orders: c.count, Revenue: c.revenue })), period)}
          />
          <CardContent>
            {data.byCustomer.length === 0 ? <EmptyState label="No customer sales" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.byCustomer.slice(0, 10).map((c) => (
                    <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{c.count}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(c.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
type SalesDataShape = {
  sales: any[]; invoices: any[]; totalSales: number; qty: number; orders: number;
  byProduct: { name: string; qty: number; revenue: number }[];
  byCustomer: { name: string; count: number; revenue: number }[];
  trend: { label: string; sales: number }[];
};


/* ---------------- Expenses ---------------- */
function ExpensesReport({ data, period }: { data: {
  purchases: any[]; wages: any[]; purchasesTotal: number; wagesTotal: number; total: number;
  categories: { name: string; value: number }[];
  trend: { label: string; purchases: number; wages: number }[];
}; period: Period }) {

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Expenses" value={formatCurrency(data.total)} icon={Wallet} tone="destructive" />
        <StatCard label="Purchases" value={formatCurrency(data.purchasesTotal)} icon={Boxes} tone="earth" />
        <StatCard label="Casual Wages" value={formatCurrency(data.wagesTotal)} icon={HardHat} tone="warning" />
        <StatCard label="Categories" value={String(data.categories.length)} icon={BarChart3} tone="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Expenses Trend">
          {data.trend.length === 0 ? <EmptyState label="No expenses" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="purchases" stackId="a" fill={CHART_COLORS[1]} name="Purchases" />
                <Bar dataKey="wages" stackId="a" fill={CHART_COLORS[3]} name="Wages" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="By Category">
          {data.categories.length === 0 ? <EmptyState label="No categories" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.categories} dataKey="value" nameKey="name" outerRadius={100} label={(e: any) => e.name}>
                  {data.categories.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <Card>
        <TableCardHeader
          title="Top Expense Categories"
          onExport={() => exportSheet("expenses-by-category", "By Category", data.categories.map((c) => ({ Category: c.name, Amount: c.value, Percent: data.total ? +((c.value / data.total) * 100).toFixed(2) : 0 })), period)}
        />
        <CardContent>
          {data.categories.length === 0 ? <EmptyState label="No expenses in this period" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">% of total</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.categories.map((c) => (
                  <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(c.value)}</TableCell><TableCell className="text-right tabular-nums">{data.total ? ((c.value / data.total) * 100).toFixed(1) : "0"}%</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <TableCardHeader
            title="Purchases"
            onExport={() => exportSheet("purchases", "Purchases", data.purchases.map((p: any) => ({
              Date: p.date, Category: p.category, Item: p.item, Supplier: p.supplierName, Amount: p.total,
            })), period)}
          />
          <CardContent>
            {data.purchases.length === 0 ? <EmptyState label="No purchases" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.purchases.slice(0, 10).map((p: any) => (
                    <TableRow key={p.id}><TableCell>{formatDate(p.date)}</TableCell><TableCell>{p.item}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(p.total)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <TableCardHeader
            title="Casual Wages"
            onExport={() => exportSheet("wages", "Wages", data.wages.map((w: any) => ({
              Date: w.date, Worker: w.workerName, Task: w.task ?? "", Days: w.daysWorked, Amount: w.total, Paid: w.paid ? "Yes" : "No",
            })), period)}
          />
          <CardContent>
            {data.wages.length === 0 ? <EmptyState label="No wages" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Worker</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.wages.slice(0, 10).map((w: any) => (
                    <TableRow key={w.id}><TableCell>{formatDate(w.date)}</TableCell><TableCell>{w.workerName}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(w.total)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


/* ---------------- P&L ---------------- */
function PnlReport({ data, monthMode, period }: { data: {
  revenue: number; expenses: number; net: number; margin: number;
  comparison: { name: string; value: number }[];
  buckets: { label: string; revenue: number; expenses: number; net: number }[];
}; monthMode: boolean; period: Period }) {
  const netTone = data.net >= 0 ? "success" : "destructive";
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatCurrency(data.revenue)} icon={TrendingUp} tone="primary" />
        <StatCard label="Expenses" value={formatCurrency(data.expenses)} icon={TrendingDown} tone="destructive" />
        <StatCard label={data.net >= 0 ? "Net Profit" : "Net Loss"} value={formatCurrency(Math.abs(data.net))} icon={PiggyBank} tone={netTone} />
        <StatCard label="Margin" value={`${data.margin.toFixed(1)}%`} icon={BarChart3} tone="earth" />
      </div>

      <ChartCard title={monthMode ? "Revenue vs Expenses (Monthly)" : "Revenue vs Expenses"}>
        {data.buckets.length === 0 ? <EmptyState label="No data" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.buckets} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="revenue" fill={CHART_COLORS[0]} name="Revenue" />
              <Bar dataKey="expenses" fill={CHART_COLORS[4]} name="Expenses" />
              {monthMode && <Bar dataKey="net" fill={CHART_COLORS[2]} name="Net" />}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <Card>
        <TableCardHeader
          title="P&L Summary"
          onExport={() => exportSheet("profit-and-loss", "P&L", [
            { Metric: "Revenue", Value: data.revenue },
            { Metric: "Expenses", Value: data.expenses },
            { Metric: data.net >= 0 ? "Net Profit" : "Net Loss", Value: data.net },
            { Metric: "Margin (%)", Value: +data.margin.toFixed(2) },
            ...data.buckets.map((b) => ({ Metric: b.label, Value: `Rev ${b.revenue} / Exp ${b.expenses} / Net ${b.net}` })),
          ], period)}
        />
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>Revenue</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(data.revenue)}</TableCell></TableRow>
              <TableRow><TableCell>Expenses</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(data.expenses)}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">{data.net >= 0 ? "Net Profit" : "Net Loss"}</TableCell><TableCell className="text-right tabular-nums font-medium">{formatCurrency(Math.abs(data.net))}</TableCell></TableRow>
              <TableRow><TableCell>Margin</TableCell><TableCell className="text-right tabular-nums">{data.margin.toFixed(1)}%</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


/* ---------------- Inventory ---------------- */
function InventoryReport({ data, period }: { data: {
  products: any[]; stockEntries: any[]; received: number; sold: number;
  lowStock: any[]; outOfStock: any[]; totalUnits: number; inventoryValue: number;
}; period: Period }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Inventory Value" value={formatCurrency(data.inventoryValue)} icon={PiggyBank} tone="primary" />
        <StatCard label="Stock Received" value={String(data.received)} icon={TrendingUp} tone="success" />
        <StatCard label="Stock Sold" value={String(data.sold)} icon={TrendingDown} tone="earth" />
        <StatCard
          label="Low / Out of Stock"
          value={`${data.lowStock.length} / ${data.outOfStock.length}`}
          icon={Boxes}
          tone={data.outOfStock.length ? "destructive" : "warning"}
        />
      </div>

      <Card>
        <TableCardHeader
          title="Current Stock"
          onExport={() => exportSheet("inventory-current-stock", "Current Stock", data.products.map((p: any) => ({
            Product: p.name, Category: p.category, Available: p.availableQuantity, Unit: p.unit, UnitPrice: p.unitPrice, Value: p.availableQuantity * p.unitPrice,
          })), period)}
        />
        <CardContent className="p-0">
          {data.products.length === 0 ? <div className="p-6"><EmptyState label="No products" /></div> : (
            <InventoryStockTable rows={data.products} />
          )}
        </CardContent>
      </Card>

      <Card>
        <TableCardHeader
          title="Stock Movements"
          onExport={() => exportSheet("stock-movements", "Stock Movements", data.stockEntries.map((e: any) => ({
            Date: e.recordedAt?.slice(0, 10), Product: e.productName, Quantity: e.quantity, Status: e.status, RecordedBy: e.recordedByUsername ?? "",
          })), period)}
        />
        <CardContent>
          {data.stockEntries.length === 0 ? <EmptyState label="No stock activity in this period" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.stockEntries.slice(0, 10).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.recordedAt ? formatDate(e.recordedAt) : "—"}</TableCell>
                    <TableCell>{e.productName}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.quantity}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function InventoryStockTable({ rows }: { rows: any[] }) {
  const ctrl = useTableView({
    data: rows,
    accessors: {
      name: (r) => r.name,
      category: (r) => r.category,
      available: (r) => Number(r.availableQuantity ?? 0),
      unitPrice: (r) => Number(r.unitPrice ?? 0),
      value: (r) => Number(r.availableQuantity ?? 0) * Number(r.unitPrice ?? 0),
    },
    defaultSort: { key: "name", dir: "asc" },
  });
  return (
    <>
      <Table>
        <TableHeader><TableRow>
          <SortableHead ctrl={ctrl} sortKey="name">Product</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="category">Category</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="available" align="right">Available</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="unitPrice" align="right">Unit Price</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="value" align="right">Value</SortableHead>
          <TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {ctrl.paged.map((p) => {
            const tone = p.availableQuantity <= 0 ? "bg-destructive/10 text-destructive" : p.availableQuantity < 20 ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success";
            const status = p.availableQuantity <= 0 ? "Out of stock" : p.availableQuantity < 20 ? "Low stock" : "OK";
            return (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="text-right tabular-nums">{p.availableQuantity} {p.unit}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.availableQuantity * p.unitPrice)}</TableCell>
                <TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TablePagination ctrl={ctrl} label="products" />
    </>
  );
}

/* ---------------- Casuals ---------------- */
function CasualsReport({ data, period }: { data: {
  workers: any[]; wages: any[]; wagesDue: number; wagesPaid: number; wagesUnpaid: number;
  activeWorkers: number;
  byWorker: { name: string; days: number; total: number; paid: number; unpaid: number }[];
}; period: Period }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Workers" value={`${data.activeWorkers} / ${data.workers.length}`} icon={HardHat} tone="primary" />
        <StatCard label="Wages Due" value={formatCurrency(data.wagesDue)} icon={Wallet} tone="earth" />
        <StatCard label="Wages Paid" value={formatCurrency(data.wagesPaid)} icon={TrendingUp} tone="success" />
        <StatCard label="Unpaid" value={formatCurrency(data.wagesUnpaid)} icon={TrendingDown} tone={data.wagesUnpaid > 0 ? "destructive" : "warning"} />
      </div>

      <Card>
        <TableCardHeader
          title="Worker Summary"
          onExport={() => exportSheet("casuals-summary", "Worker Summary", data.byWorker.map((w) => ({
            Worker: w.name, DaysWorked: w.days, TotalDue: w.total, Paid: w.paid, Unpaid: w.unpaid,
          })), period)}
        />
        <CardContent>
          {data.byWorker.length === 0 ? <EmptyState label="No work logged in this period" /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Worker</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Total Due</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Unpaid</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.byWorker.map((w) => (
                  <TableRow key={w.name}>
                    <TableCell>{w.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.days}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(w.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{formatCurrency(w.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(w.unpaid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <TableCardHeader
          title="Work Activity"
          onExport={() => exportSheet("casuals-work-activity", "Work Activity", data.wages.map((w: any) => ({
            Date: w.date, Worker: w.workerName, Task: w.task ?? "", Days: w.daysWorked, Amount: w.total, Paid: w.paid ? "Yes" : "No",
          })), period)}
        />
        <CardContent className="p-0">
          {data.wages.length === 0 ? <div className="p-6"><EmptyState label="No entries" /></div> : (
            <WorkActivityTable rows={data.wages} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function WorkActivityTable({ rows }: { rows: any[] }) {
  const ctrl = useTableView<any>({
    data: rows,
    accessors: {
      date: (r) => r.date,
      worker: (r) => r.workerName,
      task: (r) => r.task ?? "",
      days: (r) => Number(r.daysWorked ?? 0),
      amount: (r) => Number(r.total ?? 0),
      paid: (r) => (r.paid ? 1 : 0),
    },
    defaultSort: { key: "date", dir: "desc" },
  });
  return (
    <>
      <Table>
        <TableHeader><TableRow>
          <SortableHead ctrl={ctrl} sortKey="date">Date</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="worker">Worker</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="task">Task</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="days" align="right">Days</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="amount" align="right">Amount</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="paid">Payment</SortableHead>
        </TableRow></TableHeader>
        <TableBody>
          {ctrl.paged.map((w) => (
            <TableRow key={w.id}>
              <TableCell>{formatDate(w.date)}</TableCell>
              <TableCell>{w.workerName}</TableCell>
              <TableCell className="text-muted-foreground">{w.task ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{w.daysWorked}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(w.total)}</TableCell>
              <TableCell><StatusBadge status={w.paid ? "Paid" : "Unpaid"} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination ctrl={ctrl} label="entries" />
    </>
  );
}

/* ---------------- Customers ---------------- */
function CustomersReport({ data }: { data: {
  rows: { id: string; name: string; type: string; orders: number; revenue: number; lastPurchase: string; outstanding: number }[];
  total: number; active: number; inactive: number;
  top: { id: string; name: string; type: string; orders: number; revenue: number; lastPurchase: string; outstanding: number }[];
} }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Customers" value={String(data.total)} icon={Users} tone="primary" />
        <StatCard label="Active" value={String(data.active)} icon={TrendingUp} tone="success" />
        <StatCard label="Inactive" value={String(data.inactive)} icon={TrendingDown} tone="warning" />
        <StatCard label="Top Customer" value={data.top[0]?.name ?? "—"} icon={PiggyBank} tone="earth" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top Customers by Revenue</CardTitle></CardHeader>
        <CardContent>
          {data.top.length === 0 ? <EmptyState label="No customer activity" /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Customer</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Last Purchase</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.top.map((c) => (
                  <TableRow key={c.id || c.name}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.outstanding)}</TableCell>
                    <TableCell>{c.lastPurchase ? formatDate(c.lastPurchase) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All Customers</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.rows.length === 0 ? <div className="p-6"><EmptyState label="No customers" /></div> : (
            <AllCustomersTable rows={data.rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AllCustomersTable({ rows }: { rows: {
  id: string; name: string; type: string; orders: number; revenue: number; lastPurchase: string; outstanding: number;
}[] }) {
  const ctrl = useTableView({
    data: rows,
    accessors: {
      name: (r) => r.name,
      type: (r) => r.type,
      orders: (r) => r.orders,
      revenue: (r) => r.revenue,
      outstanding: (r) => r.outstanding,
      lastPurchase: (r) => r.lastPurchase,
    },
    defaultSort: { key: "revenue", dir: "desc" },
  });
  return (
    <>
      <Table>
        <TableHeader><TableRow>
          <SortableHead ctrl={ctrl} sortKey="name">Customer</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="type">Type</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="orders" align="right">Orders</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="revenue" align="right">Revenue</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="outstanding" align="right">Outstanding</SortableHead>
          <SortableHead ctrl={ctrl} sortKey="lastPurchase">Last Purchase</SortableHead>
        </TableRow></TableHeader>
        <TableBody>
          {ctrl.paged.map((c) => (
            <TableRow key={c.id || c.name}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.type}</TableCell>
              <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(c.revenue)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(c.outstanding)}</TableCell>
              <TableCell>{c.lastPurchase ? formatDate(c.lastPurchase) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination ctrl={ctrl} label="customers" />
    </>
  );
}
