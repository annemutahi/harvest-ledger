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
import { Plus, HardHat, Users, Wallet, Trash2, Check, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import {
  getWorkerAttendance, setWorkerAttendance, ATTENDANCE_CHANGE_EVENT,
} from "@/lib/attendance-store";
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
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{w.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(w.dailyRate)}</TableCell>
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
    </AppShell>
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
