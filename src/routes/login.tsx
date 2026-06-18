import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Sprout, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Peaceful Acres" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-foreground/10">
            <Sprout className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold">Peaceful Acres</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-tight">From field to ledger, every harvest accounted for.</h2>
          <p className="text-primary-foreground/80">
            Track sales, manage receivables, and keep your farm's cashflow healthy with a workspace built for growers.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© 2026 Peaceful Acres Farm</p>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Sprout className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold">Peaceful Acres</span>
            </div>
            <h1 className="text-2xl font-bold">Welcome</h1>
            <p className="mt-1 text-sm text-muted-foreground"></p>
            <form
              className="mt-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSubmitting(true);
                try {
                  await login(username, password);
                  window.location.href = "/";
                } catch (err: any) {
                  setError(err?.message?.includes("400") || err?.message?.includes("401")
                    ? "Invalid username or password."
                    : "Could not reach the server. Is the backend running?");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/login" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
                </div>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" defaultChecked />
                <Label htmlFor="remember" className="text-sm font-normal">Remember me on this device</Label>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Accounts are created by the administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
