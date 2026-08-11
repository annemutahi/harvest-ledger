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
import { BanknoteArrowUp, Pencil, Plus, Printer, Search, ShoppingCart } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canEditSales } from "@/lib/permissions";
import { useTableView } from "@/hooks/use-table-view";
import { SortableHead, TablePagination } from "@/components/table-controls";


export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const [q, setQ] = useState("");
  const query = q.toLowerCase();
  const { user } = useAuth();
  const mayEdit = canEditSales(user);
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: () => api.listSales() });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => api.listPayments() });

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
      payment.method.toLowerCase().includes(query) ||
      (payment.notes ?? "").toLowerCase().includes(query),
  );

  const salesView = useTableView({
    data: filteredSales,
    accessors: {
      customerName: (s) => s.customerName,
      date: (s) => s.date,
      amount: (s) => Number(s.amount),
      paymentType: (s) => s.paymentType,
      status: (s) => s.status,
    },
    defaultSort: { key: "date", dir: "desc" },
  });

  const paymentsView = useTableView({
    data: filteredPayments,
    accessors: {
      date: (p) => p.date,
      customerName: (p) => p.customerName,
      invoiceNumber: (p) => p.invoiceNumber,
      method: (p) => p.method,
      amount: (p) => Number(p.amount),
    },
    defaultSort: { key: "date", dir: "desc" },
  });


  return (
    <AppShell
      title="Transactions"
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
                      <SortableHead ctrl={salesView} sortKey="customerName">Customer</SortableHead>
                      <SortableHead ctrl={salesView} sortKey="date">Date</SortableHead>
                      <SortableHead ctrl={salesView} sortKey="amount" align="right">Amount</SortableHead>
                      <SortableHead ctrl={salesView} sortKey="paymentType">Payment</SortableHead>
                      <SortableHead ctrl={salesView} sortKey="status">Status</SortableHead>
                      {mayEdit && <TableHead className="w-16 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesView.total === 0 && (
                      <TableRow>
                        <TableCell colSpan={mayEdit ? 6 : 5} className="py-8 text-center text-muted-foreground">No sales match your search.</TableCell>
                      </TableRow>
                    )}
                    {salesView.paged.map((sale) => (
                      <TableRow key={sale.id}>
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
              <TablePagination ctrl={salesView} label="sales" />
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
                      <SortableHead ctrl={paymentsView} sortKey="date">Date</SortableHead>
                      <SortableHead ctrl={paymentsView} sortKey="customerName">Customer</SortableHead>
                      <SortableHead ctrl={paymentsView} sortKey="invoiceNumber">Invoice</SortableHead>
                      <SortableHead ctrl={paymentsView} sortKey="method">Method</SortableHead>
                      <TableHead>Notes</TableHead>
                      <SortableHead ctrl={paymentsView} sortKey="amount" align="right">Amount</SortableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsView.total === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No payments match your search.</TableCell>
                      </TableRow>
                    )}
                    {paymentsView.paged.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell className="font-medium">{payment.customerName}</TableCell>
                        <TableCell>
                          <Link to="/invoices/$id" params={{ id: payment.invoiceId }} className="hover:underline">
                            {payment.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{payment.method}</TableCell>
                        <TableCell className="max-w-48 truncate text-muted-foreground" title={payment.notes ?? ""}>
                          {payment.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild title="Print receipt">
                            <Link to="/payments/$id/document" params={{ id: payment.id }}>
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination ctrl={paymentsView} label="payments" />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </AppShell>
  );
}
