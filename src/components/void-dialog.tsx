import { useState, type ReactNode } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  title: string;
  description: string;
  /** Rejects to keep the dialog open; resolves to close it. */
  onConfirm: (reason: string) => Promise<unknown>;
  trigger?: ReactNode;
  pending?: boolean;
};

/**
 * Cancel a record with a mandatory reason. Records are never deleted —
 * they stay visible, marked voided, with who did it and why.
 */
export function VoidDialog({ title, description, onConfirm, trigger, pending }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReason(""); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="text-destructive">
            <Ban className="mr-2 h-4 w-4" />
            Void
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="void-reason">
            Reason (required)
          </label>
          <Textarea
            id="void-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate M-Pesa entry, recorded twice"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy || pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={reason.trim().length < 3 || busy || pending}
          >
            {busy || pending ? "Voiding…" : "Void record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
