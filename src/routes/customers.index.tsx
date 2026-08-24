import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { CustomerType } from "@/lib/types";
import { useTableView } from "@/hooks/use-table-view";
import { FieldError } from "@/components/field-error";
import {
  amountSchema,
  nameSchema,
  normalizePhone,
  optionalSchema,
  optionalPhoneSchema,
  validate,
  hasErrors,
  type FieldErrors,
} from "@/lib/validation";
import { z } from "zod";
import { SortableHead, TablePagination } from "@/components/table-controls";


export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Customers" }] }),
  component: CustomersPage,
});

const customerSchema = z.object({
  name: nameSchema,
  phone: optionalPhoneSchema,
  : optionalSchema,
  creditLimit: amountSchema,
});

function CustomersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: api.listCustomers,
  });

  const [form, setForm] = useState({
    name: "",
    type: "Individual" as CustomerType,
    company: "",
    contactPerson: "",
    phone: "",
    : "",
    creditLimit: 0,
  });

  const [errors, setErrors] = useState<FieldErrors>({});

  const createMutation = useMutation({
    mutationFn: () =>
      api.createCustomer({ ...form, phone: normalizePhone(form.phone) ?? "" }),
    onSuccess: () => {
      toast.success("Customer created");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm({ name: "", type: "Individual", company: "", contactPerson: "", phone: "", : "", creditLimit: 0 });
      setErrors({});
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to create customer"),
  });

  const filtered = (customers ?? []).filter((c) => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c..toLowerCase().includes(q.toLowerCase());
    const matchT = type === "all" || c.type === type;
    return matchQ && matchT;
  });

  const view = useTableView({
    data: filtered,
    accessors: {
      name: (c) => c.name,
      type: (c) => c.type,
      contact: (c) => c.contactPerson || c.phone,
      creditLimit: (c) => Number(c.creditLimit ?? 0),
      outstanding: (c) => Number(c.outstandingBalance ?? 0),
    },
    defaultSort: { key: "name", dir: "asc" },
  });


  return (
    <AppShell
      title="Customers"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or " value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Individual">Individual</SelectItem>
              <SelectItem value="Corporate">Corporate</SelectItem>
            </SelectContent>
          </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
            <form className="grid gap-4" onSubmit={(e) => {
              e.preventDefault();
              const found = validate(customerSchema, form);
              setErrors(found);
              if (hasErrors(found)) return;
              createMutation.mutate();
            }}>
              <div className="grid gap-2"><Label>Customer Name</Label>
                <Input required placeholder="e.g. Sunset Café" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
                <FieldError message={errors.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CustomerType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Individual">Individual</SelectItem><SelectItem value="Corporate">Corporate</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Company (optional)</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2"><Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Phone</Label>
                  <Input inputMode="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!!errors.phone} />
                  <FieldError message={errors.phone} />
                </div>
                <div className="grid gap-2"><Label></Label>
                  <Input type="" placeholder="name@example.com" value={form.} onChange={(e) => setForm({ ...form, : e.target.value })} aria-invalid={!!errors.} />
                  <FieldError message={errors.} />
                </div>
              </div>
              <div className="grid gap-2"><Label>Credit Limit (KES)</Label>
                <Input type="number" min={0} step="0.01" placeholder="50000" value={form.creditLimit || ""} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) || 0 })} aria-invalid={!!errors.creditLimit} />
                <FieldError message={errors.creditLimit} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Customer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      }
    >


      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead ctrl={view} sortKey="name">Name</SortableHead>
                  <SortableHead ctrl={view} sortKey="type">Type</SortableHead>
                  <SortableHead ctrl={view} sortKey="contact">Contact</SortableHead>
                  <SortableHead ctrl={view} sortKey="creditLimit" align="right">Credit Limit</SortableHead>
                  <SortableHead ctrl={view} sortKey="outstanding" align="right">Outstanding</SortableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
                {!isLoading && error && (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-destructive">
                    {error instanceof Error ? error.message : "Failed to load customers"}
                  </TableCell></TableRow>
                )}
                {!isLoading && !error && view.total === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No customers match your filters.</TableCell></TableRow>
                )}
                {!isLoading && !error && view.paged.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link to="/customers/$id" params={{ id: c.id }} className="font-medium hover:underline">{c.name}</Link>
                      {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                    <TableCell>
                      <p className="text-sm">{c.contactPerson}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(c.creditLimit)}</TableCell>
                    <TableCell className="text-right">
                      <span className={c.outstandingBalance > 0 ? "font-semibold text-earth" : "text-muted-foreground"}>
                        {formatCurrency(c.outstandingBalance)}
                      </span>
                    </TableCell>
                    <TableCell><Link to="/customers/$id" params={{ id: c.id }}><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination ctrl={view} label="customers" />
        </CardContent>
      </Card>
    </AppShell>

  );
}
