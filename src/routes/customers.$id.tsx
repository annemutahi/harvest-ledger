import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Mail, Phone, FileDown } from "lucide-react";
import { customers, invoices, payments, formatCurrency, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/customers/$id")({
  head: ({ params }) => ({ meta: [{ title: `Customer ${params.id} — GreenHarvest` }] }),
  loader: ({ params }) => {
    const customer = customers.find((c) => c.id === params.id);
    if (!customer) throw notFound();
    return { customer };
  },
  notFoundComponent: () => (
    <AppShell title="Customer not found"><p className="text-muted-foreground">This customer doesn't exist.</p></AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell title="Error"><p className="text-destructive">{error.message}</p></AppShell>
  ),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { customer } = Route.useLoaderData();
  const custInvoices = invoices.filter((i) => i.customerId === customer.id);
  const custPayments = payments.filter((p) => p.customerId === customer.id);
  const totalPurchases = custInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const initials = customer.name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <AppShell
      title={customer.name}
      description={customer.company || customer.type}
      actions={
        <>
          <Button variant="outline" asChild><Link to="/customers"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          <Button variant="outline"><FileDown className="mr-2 h-4 w-4" />Statement</Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{customer.name}</p>
                <Badge variant="outline" className="mt-1">{customer.type}</Badge>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{customer.email}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4 shrink-0" /><span>{customer.phone}</span></div>
              <div className="border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{customer.contactPerson}</span></div>
                <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Credit Limit</span><span>{formatCurrency(customer.creditLimit)}</span></div>
                <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold text-earth">{formatCurrency(customer.outstandingBalance)}</span></div>
                <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Total Purchases</span><span className="font-semibold">{formatCurrency(totalPurchases)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Invoice History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {custInvoices.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>}
                  {custInvoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell><Link to="/invoices/$id" params={{ id: i.id }} className="font-medium hover:underline">{i.invoiceNumber}</Link></TableCell>
                      <TableCell>{formatDate(i.invoiceDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(i.totalAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(i.outstandingBalance)}</TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {custPayments.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No payments recorded.</TableCell></TableRow>}
                  {custPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell>{p.invoiceNumber}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="text-right font-medium text-success">{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
