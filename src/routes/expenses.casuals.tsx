import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardHat } from "lucide-react";

export const Route = createFileRoute("/expenses/casuals")({
  head: () => ({ meta: [{ title: "Casuals — Peaceful Acres" }] }),
  component: CasualsPage,
});

function CasualsPage() {
  return (
    <AppShell
      title="Casuals"
      description="Track casual workers and daily wages."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            Casual labour management
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            This module is coming next: recording casual workers, logging days worked,
            calculating wages, and marking them as paid. It plugs into the same expenses
            store as Purchases so totals roll up to the dashboard automatically.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
