import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { BanknoteArrowUp, Pencil, Plus, Search, ShoppingCart } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { canEditSales } from "@/lib/permissions";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions - Peaceful Acres" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const [q, setQ] = useState("");
  const query = q.toLowerCase();
  const { user } = useAuth();
  const mayEdit = canEditSales(user);
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: api.listSales });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: api.listPayments });

  const filteredSales = sales.filter(
    (sale) =>
      !query ||
      sale.invoiceNumber.toLowerCase().includes(query) ||
      sale.customerName.toLowerCase().includes(query),
  );
  const filteredPayments = payments.filter(
    (payment) =>
      !query ||
      payment.invoiceNumber.toLowerCase().includes(query) ||
      payment.customerName.toLowerCase().includes(query) ||
      payment.method.toLowerCase().includes(query),
  );

  return (
    <AppShell
      title="Transactions"
      description="Sales and payments in one operational workspace."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/sales/new">
              <Plus className="mr-2 h-4 w-4" />
              New Sale
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/payments/new">
              <BanknoteArrowUp className="mr-2 h-4 w-4" />
              Record Payment
            </Link>
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by customer, invoice, or method"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales" className="mt-4">
        <TabsList>
          <TabsTrigger value="sales">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="payments">
            <BanknoteArrowUp className="mr-2 h-4 w-4" />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      {mayEdit && <TableHead className="w-16 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <Link
                            to="/invoices/$id"
                            params={{ id: sale.invoiceId || sale.id }}
                            className="font-medium hover:underline"
                          >
                            {sale.invoiceNumber || `#${sale.invoiceId || sale.id}`}
                          </Link>
                        </TableCell>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell>{formatDate(sale.date)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(sale.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.paymentType}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={sale.status} />
                        </TableCell>
                        {mayEdit && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" asChild title="Edit sale">
                              <Link to="/sales/$id/edit" params={{ id: sale.id }}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell className="font-medium">{payment.customerName}</TableCell>
                        <TableCell>
                          <Link to="/invoices/$id" params={{ id: payment.invoiceId }} className="hover:underline">
                            {payment.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{payment.method}</TableCell>
                        <TableCell className="text-right font-semibold text-success">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
