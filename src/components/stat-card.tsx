import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  tone?: "primary" | "earth" | "warning" | "success" | "destructive";
}

const toneClasses: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  earth: "bg-earth/15 text-earth",
  warning: "bg-warning/15 text-warning-foreground",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ label, value, icon: Icon, trend, trendDirection = "neutral", tone = "primary" }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p className={cn(
                "mt-2 text-xs font-medium",
                trendDirection === "up" && "text-success",
                trendDirection === "down" && "text-destructive",
                trendDirection === "neutral" && "text-muted-foreground",
              )}>{trend}</p>
            )}
          </div>
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
