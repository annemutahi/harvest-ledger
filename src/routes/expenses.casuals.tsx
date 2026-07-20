import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Plus, HardHat, Users, Wallet, Trash2, Check, Download, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { api, type ApiCasualWage, type ApiCasualWorker } from "@/lib/api";
import { notifyExpensesChanged } from "@/lib/expenses-store";

export const Route = createFileRoute("/expenses/casuals")({
  head: () => ({ meta: [{ title: "Casuals — Peaceful Acres" }] }),
  component: CasualsPage,
});

const WORK_AREAS = [
  "Egg Collection",
  "Poultry House 1",
  "Poultry House 2",
  "Cleaning",
  "Feeding",
  "Watering",
  "Vaccination",
  "General",
];

function CasualsPage() {
  const qc = useQueryClient();

  const { data: workers = [] } = useQuery({
    queryKey: ["casual-workers"],
    queryFn: () => api.listCasualWorkers(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["casual-wages"],
    queryFn: () => api.listCasualWages(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["casual-workers"] });
    qc.invalidateQueries({ queryKey: ["casual-wages"] });
    notifyExpensesChanged();
  };

  const markPaid = useMutation({
    mutationFn: (id: string) => api.markCasualWagePaid(id),
    onSuccess: () => { toast.success("Marked as paid"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  const deleteLog = useMutation({
    mutationFn: (id: string) => api.deleteCasualWage(id),
    onSuccess: () => { toast.success("Entry deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const toggleWorker = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateCasualWorker(id, { active }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  const deleteWorker = useMutation({
    mutationFn: (id: string) => api.deleteCasualWorker(id),
    onSuccess: () => { toast.success("Worker removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editing, setEditing] = useState<ApiCasualWage | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((w) => {
      if (fromDate && w.date < fromDate) return false;
      if (toDate && w.date > toDate) return false;
      return true;
    });
  }, [logs, fromDate, toDate]);

  const unpaidTotal = useMemo(
    () => logs.filter((w) => !w.paid).reduce((s, w) => s + w.total, 0),
    [logs],
  );
  const totalDays = logs.length;
  const unpaidCount = logs.filter((w) => !w.paid).length;

  return (
    <AppShell
      title="Casuals"
      description="Track workers, log daily work assignments and mark payments."
      actions={
        <div className="flex gap-2">
          <NewWorkerDialog onCreated={invalidate} />
          <NewLogDialog workers={workers} onCreated={invalidate} />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total work entries"
          value={String(totalDays)}
          icon={Wallet}
          tone="primary"
          trend={`${unpaidCount} unpaid`}
        />
        <StatCard label="Amount due" value={formatCurrency(unpaidTotal)} icon={HardHat} tone="warning" />
        <StatCard
          label="Active workers"
          value={String(workers.filter((w) => w.active).length)}
          icon={Users}
          tone="earth"
          trend={`${workers.length} total`}
        />
      </div>

      <Tabs defaultValue="log" className="mt-6">
        <TabsList>
          <TabsTrigger value="log">Daily work log</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-4">

          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
              <CardTitle>Work entries</CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                {(fromDate || toDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFromDate(""); setToDate(""); }}
                  >
                    <X className="mr-1 h-4 w-4" />Clear
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredLogs.length === 0}
                  onClick={() => exportLogsCsv(filteredLogs, { from: fromDate, to: toDate })}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Work area</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{formatDate(w.date)}</TableCell>
                      <TableCell className="font-medium">{w.workerName}</TableCell>
                      <TableCell>{w.task || "—"}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {w.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(w.total)}</TableCell>
                      <TableCell>
                        {w.paid ? (
                          <Badge variant="secondary">
                            Paid{w.paidAt ? ` · ${formatDate(w.paidAt)}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unpaid</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {w.paid ? (
                            <Button size="sm" variant="ghost" disabled>
                              <Check className="mr-1 h-4 w-4" />Paid
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditing(w)}
                                title="Edit entry"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => markPaid.mutate(w.id)}
                                disabled={markPaid.isPending}
                              >
                                Mark as paid
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { if (confirm("Delete this entry?")) deleteLog.mutate(w.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        {logs.length === 0
                          ? 'No work entries yet. Click "Log work" to record a day.'
                          : "No entries match the selected date range."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <EditLogDialog
            entry={editing}
            onOpenChange={(v) => { if (!v) setEditing(null); }}
            onSaved={invalidate}
          />
        </TabsContent>

        <TabsContent value="workers" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Workers</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Daily rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{w.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(w.dailyRate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={w.active}
                            onCheckedChange={(v) => toggleWorker.mutate({ id: w.id, active: v })}
                          />
                          <span className="text-xs text-muted-foreground">
                            {w.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm(`Remove ${w.name}?`)) deleteWorker.mutate(w.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {workers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No workers yet. Add one with "New worker".
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <WorkerSummary workers={workers} logs={logs} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function WorkerSummary({ workers, logs }: { workers: ApiCasualWorker[]; logs: ApiCasualWage[] }) {
  const rows = useMemo(() => {
    // Group by worker id if present, else by name.
    const byKey = new Map<string, { name: string; days: number; unpaidEntries: number; amountDue: number }>();
    // Seed with active workers so they appear even without entries.
    for (const w of workers) {
      byKey.set(w.id, { name: w.name, days: 0, unpaidEntries: 0, amountDue: 0 });
    }
    for (const l of logs) {
      const key = l.workerId ?? `name:${l.workerName}`;
      const row = byKey.get(key) ?? { name: l.workerName, days: 0, unpaidEntries: 0, amountDue: 0 };
      row.days += 1;
      if (!l.paid) {
        row.unpaidEntries += 1;
        row.amountDue += l.total;
      }
      byKey.set(key, row);
    }
    return Array.from(byKey.values()).sort((a, b) => b.days - a.days);
  }, [workers, logs]);

  return (
    <Card>
      <CardHeader><CardTitle>Worker summary</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="text-right">Total days worked</TableHead>
              <TableHead className="text-right">Unpaid entries</TableHead>
              <TableHead className="text-right">Amount due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right">{r.days}</TableCell>
                <TableCell className="text-right">{r.unpaidEntries}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(r.amountDue)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No data yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function exportLogsCsv(logs: ApiCasualWage[], range?: { from?: string; to?: string }) {
  const headers = ["Date", "Worker", "Work Area", "Notes", "Paid Status", "Payment Date", "Amount"];
  const rows = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) =>
      [
        w.date,
        w.workerName,
        (w.task ?? "").replace(/"/g, '""'),
        (w.notes ?? "").replace(/"/g, '""'),
        w.paid ? "Paid" : "Unpaid",
        w.paidAt ? w.paidAt.slice(0, 10) : "",
        w.total.toFixed(2),
      ]
        .map((v, i) => (i === 1 || i === 2 || i === 3 ? `"${v}"` : String(v)))
        .join(","),
    );

  const total = logs.reduce((s, w) => s + w.total, 0);
  const unpaid = logs.filter((w) => !w.paid).reduce((s, w) => s + w.total, 0);
  rows.push("");
  if (range?.from || range?.to) {
    rows.push(`Range,${range?.from || "…"} to ${range?.to || "…"}`);
  }
  rows.push(`Total,,,,,,${total.toFixed(2)}`);
  rows.push(`Amount due,,,,,,${unpaid.toFixed(2)}`);

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `work_log_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function EditLogDialog({
  entry, onOpenChange, onSaved,
}: {
  entry: ApiCasualWage | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");

  const open = !!entry;

  // Reset form when a new entry is opened.
  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setArea(entry.task ?? "");
      setNotes(entry.notes ?? "");
    }
  }, [entry?.id]);

  const updateLog = useMutation({
    mutationFn: (payload: Parameters<typeof api.updateCasualWage>[1]) =>
      api.updateCasualWage(entry!.id, payload),
    onSuccess: () => {
      toast.success("Entry updated");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update entry"),
  });

  const submit = () => {
    if (!entry) return;
    if (!area.trim()) return toast.error("Work area is required");
    if (!date) return toast.error("Date is required");
    updateLog.mutate({ date, task: area.trim(), notes: notes.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit work entry</DialogTitle></DialogHeader>
        {entry && (
          <div className="grid gap-3">
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Worker: <span className="font-semibold text-foreground">{entry.workerName}</span>
              {" · "}Amount: <span className="font-semibold text-foreground">{formatCurrency(entry.total)}</span>
            </div>
            <div className="grid gap-1.5">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Work area / assignment *</Label>
              <Select value={WORK_AREAS.includes(area) ? area : ""} onValueChange={setArea}>
                <SelectTrigger><SelectValue placeholder="Select an assignment" /></SelectTrigger>
                <SelectContent>
                  {WORK_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="mt-1"
                value={WORK_AREAS.includes(area) ? "" : area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="…or type a custom assignment"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={updateLog.isPending}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function NewWorkerDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");

  const reset = () => { setName(""); setPhone(""); setRate(""); };

  const createWorker = useMutation({
    mutationFn: (payload: Parameters<typeof api.createCasualWorker>[0]) => api.createCasualWorker(payload),
    onSuccess: () => {
      toast.success("Worker added");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save worker"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New worker</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New casual worker</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Full name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Phone number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Daily rate *</Label>
              <Input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={createWorker.isPending}
            onClick={() => {
              if (!name.trim()) return toast.error("Name is required");
              createWorker.mutate({
                name: name.trim(),
                phone: phone.trim() || undefined,
                dailyRate: Number(rate) || 0,
              });
            }}
          >
            Save worker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLogDialog({
  workers, onCreated,
}: {
  workers: ApiCasualWorker[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");

  const activeWorkers = workers.filter((w) => w.active);
  const selected = workers.find((w) => w.id === workerId);

  const reset = () => {
    setWorkerId("");
    setDate(new Date().toISOString().slice(0, 10));
    setArea("");
    setNotes("");
  };

  const createLog = useMutation({
    mutationFn: (payload: Parameters<typeof api.createCasualWage>[0]) => api.createCasualWage(payload),
    onSuccess: () => {
      toast.success("Work logged");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to log work"),
  });

  const submit = () => {
    if (!selected) return toast.error("Choose a worker");
    if (!area.trim()) return toast.error("Work area is required");
    if (selected.dailyRate <= 0) return toast.error("Worker has no daily rate set");

    createLog.mutate({
      workerId: selected.id,
      workerName: selected.name,
      date,
      daysWorked: 1,
      ratePerDay: selected.dailyRate,
      task: area.trim(),
      paid: false,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Log work</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log daily work</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Worker *</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                <SelectContent>
                  {activeWorkers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} — {formatCurrency(w.dailyRate)}/day
                    </SelectItem>
                  ))}
                  {activeWorkers.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">No active workers.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Work area / assignment *</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger><SelectValue placeholder="Select an assignment" /></SelectTrigger>
              <SelectContent>
                {WORK_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-1"
              value={WORK_AREAS.includes(area) ? "" : area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="…or type a custom assignment"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>

          {selected && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Amount for this entry:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(selected.dailyRate)}</span>{" "}
              (worker's daily rate)
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createLog.isPending}>Save entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
