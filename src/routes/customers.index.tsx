import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, ChevronRight } from "lucide-react";
import { customers, formatCurrency } from "@/lib/mock-data";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Customers — GreenHarvest" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const filtered = customers.filter((c) => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase());
    const matchT = type === "all" || c.type === type;
    return matchQ && matchT;
  });

  return (
    <AppShell
      title="Customers"
      description="Individuals and corporate accounts you sell to."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
              <div className="grid gap-2"><Label>Customer Name</Label><Input placeholder="e.g. Sunset Café" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Type</Label>
                  <Select defaultValue="Individual"><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Individual">Individual</SelectItem><SelectItem value="Corporate">Corporate</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Company (optional)</Label><Input /></div>
              </div>
              <div className="grid gap-2"><Label>Contact Person</Label><Input /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Phone</Label><Input /></div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" /></div>
              </div>
              <div className="grid gap-2"><Label>Credit Limit (KES)</Label><Input type="number" placeholder="50000" /></div>
              <DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save Customer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Individual">Individual</SelectItem>
                <SelectItem value="Corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No customers match your filters.</TableCell></TableRow>
                )}
                {filtered.map((c) => (
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
        </CardContent>
      </Card>
    </AppShell>
  );
}
