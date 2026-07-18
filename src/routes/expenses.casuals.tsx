import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Plus, HardHat, Users, Wallet, Trash2, Check, CalendarDays, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import {
  getWorkerAttendanceMap, setWorkerAttendance, setDayEntry, removeDay,
  ATTENDANCE_CHANGE_EVENT, type WorkerAttendance, type AttendanceEntry,
} from "@/lib/attendance-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { notifyExpensesChanged, type CasualWorker } from "@/lib/expenses-store";

export const Route = createFileRoute("/expenses/casuals")({
  head: () => ({ meta: [{ title: "Casuals — Peaceful Acres" }] }),
  component: CasualsPage,
});

function CasualsPage() {
  const qc = useQueryClient();
  const [attendanceWorker, setAttendanceWorker] = useState<CasualWorker | null>(null);


  const { data: workers = [] } = useQuery({
    queryKey: ["casual-workers"],
    queryFn: () => api.listCasualWorkers(),
  });
  const { data: wages = [] } = useQuery({
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

  const deleteWage = useMutation({
    mutationFn: (id: string) => api.deleteCasualWage(id),
    onSuccess: () => { toast.success("Wage entry deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const deleteWorker = useMutation({
    mutationFn: (id: string) => api.deleteCasualWorker(id),
    onSuccess: () => { toast.success("Worker removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const now = new Date();
  const monthTotal = useMemo(
    () =>
      wages
        .filter((w) => {
          const d = new Date(w.date);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((s, w) => s + w.total, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wages],
  );

  const unpaidTotal = useMemo(
    () => wages.filter((w) => !w.paid).reduce((s, w) => s + w.total, 0),
    [wages],
  );

  return (
    <AppShell
      title="Casuals"
      description="Track casual workers, log days worked and manage wages."
      actions={
        <div className="flex gap-2">
          <NewWorkerDialog onCreated={invalidate} />
          <NewWageDialog workers={workers} onCreated={invalidate} />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Wages this month"
          value={formatCurrency(monthTotal)}
          icon={Wallet}
          tone="warning"
          trend={`${wages.filter((w) => {
            const d = new Date(w.date);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          }).length} entries`}
        />
        <StatCard label="Outstanding (unpaid)" value={formatCurrency(unpaidTotal)} icon={HardHat} tone="earth" />
        <StatCard label="Workers on roster" value={String(workers.length)} icon={Users} tone="primary" />
      </div>

      <Tabs defaultValue="wages" className="mt-6">
        <TabsList>
          <TabsTrigger value="wages">Wage log</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
        </TabsList>

        <TabsContent value="wages" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Wage entries</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wages.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{formatDate(w.date)}</TableCell>
                      <TableCell className="font-medium">{w.workerName}</TableCell>
                      <TableCell>
                        <div>{w.task ?? "—"}</div>
                        {w.notes && <p className="mt-1 text-xs text-muted-foreground">{w.notes}</p>}
                      </TableCell>
                      <TableCell className="text-right">{w.daysWorked}</TableCell>
                      <TableCell className="text-right">{formatCurrency(w.ratePerDay)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(w.total)}</TableCell>
                      <TableCell>
                        {w.paid ? <Badge variant="secondary">Paid</Badge> : <Badge variant="outline">Unpaid</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!w.paid && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Mark paid"
                              onClick={() => markPaid.mutate(w.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { if (confirm("Delete this wage entry?")) deleteWage.mutate(w.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {wages.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No wage entries yet. Click “Log wage” to record one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Workers</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Daily rate</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => setAttendanceWorker(w)}
                          className="text-left text-primary underline-offset-2 hover:underline"
                        >
                          {w.name}
                        </button>
                      </TableCell>
                      <TableCell>{w.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(w.dailyRate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Attendance"
                            onClick={() => setAttendanceWorker(w)}
                          >
                            <CalendarDays className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { if (confirm(`Remove ${w.name}?`)) deleteWorker.mutate(w.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {workers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                        No workers yet. Add one with “New worker”.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AttendanceSheet
        worker={attendanceWorker}
        onClose={() => setAttendanceWorker(null)}
      />
    </AppShell>
  );
}

function exportAttendanceCsv(
  worker: CasualWorker,
  month: Date,
  entries: WorkerAttendance,
) {
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const rows = Object.entries(entries)
    .filter(([iso]) => iso.startsWith(monthKey))
    .sort(([a], [b]) => a.localeCompare(b));

  const headers = ["Date", "Day", "Fraction", "Standard Pay", "Custom Pay", "Actual Pay", "Note"];
  const body = rows.map(([iso, entry]) => {
    const d = new Date(iso + "T00:00:00");
    const day = d.toLocaleDateString(undefined, { weekday: "long" });
    const fraction = entry.fraction;
    const standardPay = fraction * worker.dailyRate;
    const customPay = entry.pay ?? "";
    const actualPay = entry.pay != null ? entry.pay : standardPay;
    const note = (entry.note ?? "").replace(/"/g, '""');
    return [
      iso,
      day,
      fraction,
      standardPay.toFixed(2),
      customPay === "" ? "" : customPay.toFixed(2),
      actualPay.toFixed(2),
      `"${note}"`,
    ].join(",");
  });

  const total = rows.reduce(
    (s, [, e]) => s + (e.pay != null ? e.pay : e.fraction * worker.dailyRate),
    0,
  );
  const totalDays = rows.reduce((s, [, e]) => s + e.fraction, 0);

  body.push("");
  body.push(`Total days,${totalDays.toFixed(2)},,,,,`);
  body.push(`Estimated wage,,,,,${total.toFixed(2)},`);
  body.push(`Daily rate,,,,,${worker.dailyRate.toFixed(2)},`);

  const csv = [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${worker.name.replace(/\s+/g, "_")}_attendance_${monthKey}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AttendanceSheet({
  worker,
  onClose,
}: {
  worker: CasualWorker | null;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [entries, setEntries] = useState<WorkerAttendance>({});

  const workerId = worker?.id ?? "";

  useEffect(() => {
    if (!workerId) return;
    const load = () => setEntries(getWorkerAttendanceMap(workerId));
    load();
    window.addEventListener(ATTENDANCE_CHANGE_EVENT, load);
    return () => window.removeEventListener(ATTENDANCE_CHANGE_EVENT, load);
  }, [workerId]);

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const selectedDates = Object.keys(entries).map((iso) => new Date(iso + "T00:00:00"));

  const handleSelect = (selected: Date[] | undefined) => {
    if (!workerId) return;
    setWorkerAttendance(workerId, (selected ?? []).map(toIso));
  };

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthEntries = Object.entries(entries)
    .filter(([iso]) => iso.startsWith(monthKey))
    .sort(([a], [b]) => a.localeCompare(b));

  const monthDayCount = monthEntries.reduce((s, [, e]) => s + e.fraction, 0);
  const monthWage = worker
    ? monthEntries.reduce(
        (s, [, e]) => s + (e.pay != null ? e.pay : e.fraction * worker.dailyRate),
        0,
      )
    : 0;

  const monthLabel = month.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <Sheet open={!!worker} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{worker?.name ?? ""} — Attendance</SheetTitle>
          <SheetDescription>
            Click a day to toggle attendance. Click a listed day below to edit half-day or custom pay.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 p-2">
          <Button size="icon" variant="ghost"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">{monthLabel}</div>
          <Button size="icon" variant="ghost"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex justify-center">
          <Calendar
            mode="multiple"
            month={month}
            onMonthChange={setMonth}
            selected={selectedDates}
            onSelect={handleSelect}
            className="pointer-events-auto"
          />
        </div>

        <div className="mt-4 rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Days present in {monthLabel}</span>
            <Badge variant="secondary">{monthDayCount}</Badge>
          </div>
          {worker && monthEntries.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Estimated wage this month:{" "}
                <span className="font-semibold text-foreground">{formatCurrency(monthWage)}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportAttendanceCsv(worker, month, entries)}
              >
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )}
        </div>

        {worker && monthEntries.length > 0 && (
          <div className="mt-4 space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Day details
            </div>
            <div className="rounded-md border divide-y">
              {monthEntries.map(([iso, entry]) => (
                <DayRow
                  key={iso}
                  iso={iso}
                  entry={entry}
                  dailyRate={worker.dailyRate}
                  onSave={(next) => setDayEntry(workerId, iso, next)}
                  onRemove={() => removeDay(workerId, iso)}
                />
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DayRow({
  iso, entry, dailyRate, onSave, onRemove,
}: {
  iso: string;
  entry: AttendanceEntry;
  dailyRate: number;
  onSave: (next: AttendanceEntry) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "half" | "custom">(
    entry.pay != null ? "custom" : entry.fraction === 0.5 ? "half" : "full",
  );
  const [fraction, setFraction] = useState(String(entry.fraction ?? 1));
  const [pay, setPay] = useState(entry.pay != null ? String(entry.pay) : "");
  const [note, setNote] = useState(entry.note ?? "");

  const effectivePay = entry.pay != null ? entry.pay : entry.fraction * dailyRate;
  const label = new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });

  const save = () => {
    let next: AttendanceEntry;
    if (mode === "full") next = { fraction: 1, note: note.trim() || undefined };
    else if (mode === "half") next = { fraction: 0.5, note: note.trim() || undefined };
    else {
      const f = Number(fraction) || 0;
      const p = pay.trim() === "" ? undefined : Number(pay);
      if (f <= 0 && p == null) { toast.error("Enter a fraction or custom pay"); return; }
      next = { fraction: f > 0 ? f : 1, pay: p, note: note.trim() || undefined };
    }
    onSave(next);
    setOpen(false);
    toast.success("Day updated");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between p-2 text-left hover:bg-muted/40"
        >
          <div>
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">
              {entry.fraction === 1 && entry.pay == null
                ? "Full day"
                : entry.pay != null
                  ? `Custom pay (${entry.fraction} day)`
                  : `${entry.fraction} day`}
              {entry.note ? ` · ${entry.note}` : ""}
            </div>
          </div>
          <div className="text-sm font-semibold">{formatCurrency(effectivePay)}</div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-3">
          <div className="text-sm font-medium">Edit {label}</div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full day (1.0)</SelectItem>
                <SelectItem value="half">Half day (0.5)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "custom" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Fraction</Label>
                <Input
                  type="number" min="0" step="0.25"
                  value={fraction}
                  onChange={(e) => setFraction(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Custom pay</Label>
                <Input
                  type="number" min="0" step="any"
                  value={pay}
                  onChange={(e) => setPay(e.target.value)}
                  placeholder={String(dailyRate)}
                />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => { onRemove(); setOpen(false); }}>
              <Trash2 className="mr-1 h-4 w-4" />Remove
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Default daily rate</Label>
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

function NewWageDialog({
  workers, onCreated,
}: {
  workers: CasualWorker[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [workerNameFallback, setWorkerNameFallback] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState("1");
  const [rate, setRate] = useState("");
  const [task, setTask] = useState("");
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState("");

  const selected = workers.find((w) => w.id === workerId);
  const effectiveRate = Number(rate) || selected?.dailyRate || 0;
  const total = (Number(days) || 0) * effectiveRate;

  const reset = () => {
    setWorkerId(""); setWorkerNameFallback("");
    setDate(new Date().toISOString().slice(0, 10));
    setDays("1"); setRate(""); setTask(""); setPaid(false); setNotes("");
  };

  const createWage = useMutation({
    mutationFn: (payload: Parameters<typeof api.createCasualWage>[0]) => api.createCasualWage(payload),
    onSuccess: () => {
      toast.success("Wage logged");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to log wage"),
  });

  const submit = () => {
    const worker = workers.find((w) => w.id === workerId);
    const workerName = worker?.name ?? workerNameFallback.trim();
    if (!workerName) return toast.error("Choose a worker or enter a name");
    if ((Number(days) || 0) <= 0) return toast.error("Days must be greater than 0");
    if (effectiveRate <= 0) return toast.error("Rate must be greater than 0");

    createWage.mutate({
      workerId: worker?.id,
      workerName,
      date,
      daysWorked: Number(days),
      ratePerDay: effectiveRate,
      task: task.trim() || undefined,
      paid,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Log wage</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Log casual wage</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Worker</Label>
              {workers.length > 0 ? (
                <Select value={workerId} onValueChange={setWorkerId}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} — {formatCurrency(w.dailyRate)}/day
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={workerNameFallback} onChange={(e) => setWorkerNameFallback(e.target.value)} placeholder="Worker name" />
              )}
              {workers.length > 0 && !workerId && (
                <Input
                  className="mt-2"
                  value={workerNameFallback}
                  onChange={(e) => setWorkerNameFallback(e.target.value)}
                  placeholder="…or type a one-off worker"
                />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Days worked</Label>
              <Input type="number" min="0" step="any" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Rate / day</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={selected ? String(selected.dailyRate) : "0"}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Total</Label>
              <Input readOnly value={formatCurrency(total)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Task</Label>
            <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Harvesting maize" />
          </div>

          <div className="grid gap-1.5">
            <Label>Payment status</Label>
            <Select value={paid ? "paid" : "unpaid"} onValueChange={(v) => setPaid(v === "paid")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createWage.isPending}>Save wage</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
