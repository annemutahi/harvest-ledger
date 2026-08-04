import { cn } from "@/lib/utils";

/** Inline validation message rendered under a form control. */
export function FieldError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-xs font-medium text-destructive", className)}>
      {message}
    </p>
  );
}
