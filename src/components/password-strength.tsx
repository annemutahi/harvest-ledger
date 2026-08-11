import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRule = { label: string; met: boolean };

/** Mirror of the server-side password policy (length + complexity). */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isStrongPassword(password: string) {
  return passwordRules(password).every((rule) => rule.met);
}

export function passwordStrengthScore(password: string) {
  return passwordRules(password).filter((rule) => rule.met).length;
}

/** Live checklist + strength meter shown while the user types. */
export function PasswordStrength({
  password,
  confirm,
  showMatch = true,
  className,
}: {
  password: string;
  confirm?: string;
  showMatch?: boolean;
  className?: string;
}) {
  const rules = passwordRules(password);
  const score = rules.filter((r) => r.met).length;
  const pct = (score / rules.length) * 100;
  const tone =
    score <= 2 ? "bg-destructive" : score < rules.length ? "bg-warning" : "bg-success";
  const label = score <= 2 ? "Weak" : score < rules.length ? "Fair" : "Strong";

  const items: PasswordRule[] = [
    ...rules,
    ...(showMatch && confirm !== undefined
      ? [{ label: "Passwords match", met: password.length > 0 && password === confirm }]
      : []),
  ];

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-300", tone)}
            style={{ width: `${password ? Math.max(pct, 8) : 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{password ? label : ""}</span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((rule) => (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              rule.met ? "text-success" : "text-muted-foreground",
            )}
          >
            {rule.met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-60" />}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
