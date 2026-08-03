import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Peaceful Acres Farm" },
      {
        name: "description",
        content:
          "Request a password reset link for your Peaceful Acres Farm Limited account.",
      },
      { property: "og:title", content: "Reset your password — Peaceful Acres Farm" },
      {
        property: "og:description",
        content: "Request a password reset link for your farm workspace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 flex items-center gap-2">
            <img src="/assets/favicon.png" alt="" className="h-10 w-10 rounded-full" />
            <span className="text-lg font-semibold">Peaceful Acres Farm Limited</span>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                If <span className="font-medium text-foreground">{email}</span> is registered,
                we've sent a link to reset your password. The link expires in a few hours and can
                only be used once.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the email registered to your account and we'll send you a reset link.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (submitting) return;
                  setError(null);
                  setSubmitting(true);
                  try {
                    await api.requestPasswordReset(email.trim());
                    setSent(true);
                  } catch {
                    setError("Could not reach the server. Please try again shortly.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
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
