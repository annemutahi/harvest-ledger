import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, FileSpreadsheet, Wallet, AlarmClock, Users, TrendingDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportCsv, stampToday } from "@/lib/csv";
import { useTableView } from "@/hooks/use-table-view";
import { SortableHead, TablePagination } from "@/components/table-controls";
import type { Invoice } from "@/lib/types";

export const Route = createFileRoute("/receivables")({
  head: () => ({
    meta: [
      { title: "Receivables & Aging — Peaceful Acres" },
      { name: "description", content: "See who owes what and how overdue each balance is, bucketed by age." },
      { property: "og:title", content: "Receivables & Aging — Peaceful Acres" },
      { property: "og:description", content: "Outstanding customer balances bucketed into current, 1-30, 31-60, 61-90 and 90+ days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceivablesPage,
});

const BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"] as const;
type Bucket = (typeof BUCKETS)[number];

const daysPastDue = (dueDate: string) => {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
};

const bucketOf = (days: number): Bucket =>
  days <= 0 ? "Current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";

const emptyBuckets = (): Record<Bucket, number> => ({ Current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });

interface AgedInvoice {
  invoice: Invoice;
  days: number;
  bucket: Bucket;
  outstanding: number;
}

interface CustomerRow {
  customerId: string;
  customerName: string;
  buckets: Record<Bucket, number>;
  total: number;
  oldestDays: number;
  invoices: AgedInvoice[];
}

function ReceivablesPage() {
  const [q, setQ] = useState("");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.listInvoices(),
  });

  const aged = useMemo<AgedInvoice[]>(() => {
    if (!invoices) return [];
    return invoices
      .filter((inv) => (inv.outstandingBalance ?? 0) > 0.005)
      .map((inv) => {
        const days = daysPastDue(inv.dueDate || inv.invoiceDate);
        return { invoice: inv, days, bucket: bucketOf(days), outstanding: inv.outstandingBalance };
      });
  }, [invoices]);

  const rows = useMemo<CustomerRow[]>(() => {
    const byCustomer = new Map<string, CustomerRow>();
    for (const a of aged) {
      const key = a.invoice.customerId || a.invoice.customerName;
      let row = byCustomer.get(key);
      if (!row) {
        row = {
          customerId: a.invoice.customerId,
          customerName: a.invoice.customerName,
          buckets: emptyBuckets(),
          total: 0,
          oldestDays: 0,
          invoices: [],
        };
        byCustomer.set(key, row);
      }
      row.buckets[a.bucket] += a.outstanding;
      row.total += a.outstanding;
      row.oldestDays = Math.max(row.oldestDays, a.days);
      row.invoices.push(a);
    }
    for (const row of byCustomer.values()) row.invoices.sort((x, y) => y.days - x.days);
    return [...byCustomer.values()];
  }, [aged]);

  const totals = useMemo(() => {
    const buckets = emptyBuckets();
    let total = 0;
    for (const a of aged) {
      buckets[a.bucket] += a.outstanding;
      total += a.outstanding;
    }
    const overdue = total - buckets.Current;
    return { buckets, total, overdue };
  }, [aged]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !r.customerName.toLowerCase().includes(needle)) return false;
      if (bucketFilter !== "all" && r.buckets[bucketFilter as Bucket] <= 0) return false;
      return true;
    });
  }, [rows, q, bucketFilter]);

  const view = useTableView<CustomerRow>({
    data: filtered,
    defaultSort: { key: "total", dir: "desc" },
    accessors: {
      customerName: (r) => r.customerName.toLowerCase(),
      total: (r) => r.total,
      oldestDays: (r) => r.oldestDays,
      Current: (r) => r.buckets.Current,
      "1-30": (r) => r.buckets["1-30"],
      "31-60": (r) => r.buckets["31-60"],
      "61-90": (r) => r.buckets["61-90"],
      "90+": (r) => r.buckets["90+"],
    },
    defaultPageSize: 25,
  });


  const exportRows = () =>
    filtered
      .slice()
      .sort((a, b) => b.total - a.total)
      .map((r) => ({
        Customer: r.customerName,
        Current: r.buckets.Current,
        "1-30 days": r.buckets["1-30"],
        "31-60 days": r.buckets["31-60"],
        "61-90 days": r.buckets["61-90"],
        "90+ days": r.buckets["90+"],
        Total: r.total,
        "Oldest (days)": r.oldestDays,
      }));

  const handleCsv = () => {
    const data = exportRows();
    exportCsv(
      `receivables-aging-${stampToday()}.csv`,
      ["Customer", "Current", "1-30 days", "31-60 days", "61-90 days", "90+ days", "Total", "Oldest (days)"],
      data.map((r) => Object.values(r)),
      [["Grand total", totals.buckets.Current, totals.buckets["1-30"], totals.buckets["31-60"], totals.buckets["61-90"], totals.buckets["90+"], totals.total, ""]],
    );
  };

  const handleExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Receivables & Aging"],
      ["Generated", new Date().toLocaleString("en-GB")],
      [],
      ["Bucket", "Amount"],
      ...BUCKETS.map((b) => [b, totals.buckets[b]]),
      ["Total", totals.total],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
    const data = exportRows();
    XLSX.utils.book_append_sheet(
      wb,
      data.length ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([["No outstanding balances"]]),
      "By customer",
    );
    const detail = aged.map((a) => ({
      Customer: a.invoice.customerName,
      Invoice: a.invoice.invoiceNumber,
      "Invoice date": a.invoice.invoiceDate,
      "Due date": a.invoice.dueDate,
      "Days past due": a.days > 0 ? a.days : 0,
      Bucket: a.bucket,
      Total: a.invoice.totalAmount,
      Paid: a.invoice.amountPaid,
      Outstanding: a.outstanding,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      detail.length ? XLSX.utils.json_to_sheet(detail) : XLSX.utils.aoa_to_sheet([["No outstanding invoices"]]),
      "Invoice detail",
    );
    XLSX.writeFile(wb, `receivables-aging-${stampToday()}.xlsx`);
  };

  const bucketTone = (b: Bucket) =>
    b === "Current" ? "text-muted-foreground" : b === "90+" ? "text-destructive font-semibold" : "";

  return (
    <AppShell title="Receivables & Aging" description="Who owes what, and how overdue each balance is.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total outstanding" value={formatCurrency(totals.total)} icon={Wallet} tone="primary" />
          <StatCard label="Overdue" value={formatCurrency(totals.overdue)} icon={AlarmClock} tone="warning" />
          <StatCard label="90+ days" value={formatCurrency(totals.buckets["90+"])} icon={TrendingDown} tone="destructive" />
          <StatCard label="Customers owing" value={String(rows.length)} icon={Users} tone="earth" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aging buckets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {BUCKETS.map((b) => {
                  const amount = totals.buckets[b];
                  const pct = totals.total > 0 ? (amount / totals.total) * 100 : 0;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBucketFilter(bucketFilter === b ? "all" : b)}
                      className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${
                        bucketFilter === b ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <p className="text-xs font-medium text-muted-foreground">{b === "Current" ? "Current (not due)" : `${b} days`}</p>
                      <p className={`mt-1 text-lg font-bold ${bucketTone(b)}`}>{formatCurrency(amount)}</p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${b === "90+" ? "bg-destructive" : b === "Current" ? "bg-success" : "bg-warning"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search customer…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Select value={bucketFilter} onValueChange={setBucketFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All buckets</SelectItem>
                  {BUCKETS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b === "Current" ? "Current (not due)" : `${b} days`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCsv} disabled={!filtered.length}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExcel} disabled={!filtered.length}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-destructive">Could not load invoices.</p>
            ) : !filtered.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {rows.length ? "No customers match these filters." : "No outstanding receivables. Everything is settled."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHead sortKey="customerName" view={view}>Customer</SortableHead>
                        {BUCKETS.map((b) => (
                          <SortableHead key={b} sortKey={b} view={view} className="text-right">
                            {b === "Current" ? "Current" : b}
                          </SortableHead>
                        ))}
                        <SortableHead sortKey="total" view={view} className="text-right">Total</SortableHead>
                        <SortableHead sortKey="oldestDays" view={view} className="text-right">Oldest</SortableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {view.rows.map((r) => {
                        const key = r.customerId || r.customerName;
                        const isOpen = expanded === key;
                        return (
                          <>
                            <TableRow
                              key={key}
                              className="cursor-pointer"
                              onClick={() => setExpanded(isOpen ? null : key)}
                            >
                              <TableCell className="font-medium">{r.customerName}</TableCell>
                              {BUCKETS.map((b) => (
                                <TableCell key={b} className={`text-right ${bucketTone(b)}`}>
                                  {r.buckets[b] > 0 ? formatCurrency(r.buckets[b]) : "—"}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-semibold">{formatCurrency(r.total)}</TableCell>
                              <TableCell className="text-right">
                                {r.oldestDays > 0 ? (
                                  <Badge variant={r.oldestDays > 90 ? "destructive" : "secondary"}>{r.oldestDays}d</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow key={`${key}-detail`} className="bg-muted/40 hover:bg-muted/40">
                                <TableCell colSpan={BUCKETS.length + 4} className="p-0">
                                  <div className="p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-xs font-medium text-muted-foreground">Outstanding invoices</p>
                                      {r.customerId && (
                                        <Link
                                          to="/customers/$id/statement"
                                          params={{ id: r.customerId }}
                                          className="text-xs font-medium text-primary hover:underline"
                                        >
                                          View statement
                                        </Link>
                                      )}
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Invoice</TableHead>
                                          <TableHead>Issued</TableHead>
                                          <TableHead>Due</TableHead>
                                          <TableHead className="text-right">Days past due</TableHead>
                                          <TableHead className="text-right">Total</TableHead>
                                          <TableHead className="text-right">Paid</TableHead>
                                          <TableHead className="text-right">Outstanding</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {r.invoices.map((a) => (
                                          <TableRow key={a.invoice.id}>
                                            <TableCell>
                                              <Link
                                                to="/invoices/$id"
                                                params={{ id: a.invoice.id }}
                                                className="font-medium text-primary hover:underline"
                                              >
                                                {a.invoice.invoiceNumber}
                                              </Link>
                                            </TableCell>
                                            <TableCell>{formatDate(a.invoice.invoiceDate)}</TableCell>
                                            <TableCell>{a.invoice.dueDate ? formatDate(a.invoice.dueDate) : "—"}</TableCell>
                                            <TableCell className="text-right">{a.days > 0 ? `${a.days}d` : "Not due"}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(a.invoice.totalAmount)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(a.invoice.amountPaid)}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(a.outstanding)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination view={view} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
