import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type Search = { uid?: string; token?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    uid: typeof search.uid === "string" ? search.uid : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password — Peaceful Acres Farm" },
      {
        name: "description",
        content: "Set a new password for your Peaceful Acres Farm Limited account.",
      },
      { property: "og:title", content: "Choose a new password — Peaceful Acres Farm" },
      {
        property: "og:description",
        content: "Set a new password for your farm workspace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { uid, token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const linkValid = Boolean(uid && token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 flex items-center gap-2">
            <img src="/assets/favicon.png" alt="" className="h-10 w-10 rounded-full" />
            <span className="text-lg font-semibold">Peaceful Acres Farm Limited</span>
          </div>

          {!linkValid ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Link not valid</h1>
              <p className="text-sm text-muted-foreground">
                This reset link is incomplete or has expired. Request a fresh one to continue.
              </p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Choose a new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Use at least 10 characters. Avoid common or numeric-only passwords.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (submitting) return;
                  setError(null);
                  if (password !== confirm) {
                    setError("The two passwords don't match.");
                    return;
                  }
                  if (!isStrongPassword(password)) {
                    setError("Your password does not meet all the requirements below.");
                    return;
                  }
                  setSubmitting(true);
                  try {
                    await api.confirmPasswordReset(uid!, token!, password);
                    toast.success("Password updated. Please sign in.");
                    navigate({ to: "/login", replace: true });
                  } catch (err: any) {
                    const raw = String(err?.message ?? "");
                    const match = raw.match(/\{[\s\S]*\}$/);
                    let message =
                      "This reset link is invalid or has expired. Request a new one.";
                    if (match) {
                      try {
                        const body = JSON.parse(match[0]);
                        if (Array.isArray(body.password)) message = body.password.join(" ");
                        else if (body.detail) message = body.detail;
                      } catch {
                        /* keep default */
                      }
                    }
                    setError(message);
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <PasswordStrength password={password} confirm={confirm} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                  <FieldError
                    message={
                      confirm && confirm !== password ? "The two passwords don't match." : undefined
                    }
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting || !isStrongPassword(password) || password !== confirm}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm">
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
