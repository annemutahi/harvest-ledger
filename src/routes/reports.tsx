import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, FileDown, BarChart3, Wallet, BanknoteArrowUp, FileText, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Peaceful Acres" }] }),
  component: ReportsPage,
});

const reports = [
  { id: "sales", title: "Sales Report", desc: "Revenue by period, product, and customer.", icon: BarChart3 },
  { id: "receivables", title: "Receivables Report", desc: "Outstanding balances and aging.", icon: Wallet },
  { id: "payments", title: "Payments Report", desc: "Payments received by method and date.", icon: BanknoteArrowUp },
  { id: "statements", title: "Customer Statements", desc: "Per-customer activity statements.", icon: FileText },
  { id: "overdue", title: "Overdue Accounts", desc: "Customers with past-due invoices.", icon: AlertTriangle },
];

function ReportsPage() {
  return (
    <AppShell title="Reports & Statements" description="Generate operational and financial reports.">
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-2"><Label>From</Label><Input type="date" defaultValue="2026-01-01" /></div>
            <div className="grid gap-2"><Label>To</Label><Input type="date" defaultValue="2026-06-13" /></div>
            <div className="flex gap-2">
              <Button variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
              <Button variant="outline"><FileDown className="mr-2 h-4 w-4" />PDF</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales" className="mt-6">
        <TabsList className="flex flex-wrap">
          {reports.map((r) => <TabsTrigger key={r.id} value={r.id}>{r.title}</TabsTrigger>)}
        </TabsList>
        {reports.map((r) => (
          <TabsContent key={r.id} value={r.id}>
            <Card>
              <CardContent className="p-12 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <r.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                <p className="mt-4 text-xs text-muted-foreground">Apply filters above and export.</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
