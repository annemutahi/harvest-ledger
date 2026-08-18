import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const dot: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-yellow-500",
  danger: "bg-red-500",
};

export function NotificationBell() {
  const { notifications, unreadCount, isRead, markAllRead, markRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {notifications.length > 0 && unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              to={n.to}
              onClick={() => markRead(n.id)}
              className={cn(
                "flex gap-2 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/60",
                !isRead(n.id) && "bg-muted/30",
              )}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[n.severity])} />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{n.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{n.message}</span>
              </span>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
