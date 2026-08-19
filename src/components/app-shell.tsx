import { type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { LogOut, User } from "lucide-react";
import GlobalSearch from "./global-search";
import NotificationBell from "./notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";


interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  showSearch?: boolean;
  children: ReactNode;
}

export function AppShell({ title, description, actions, showSearch = false, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const initials = user?.username
    ? user.username
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "U";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            <SidebarTrigger className="shrink-0" />
            {showSearch && (
              <div className="relative hidden flex-1 max-w-md md:block">
                <GlobalSearch />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">
                    {user?.username ?? "Account"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
              {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
