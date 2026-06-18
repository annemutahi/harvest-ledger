import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, FileText, CreditCard, BarChart3, Settings, Drumstick, Box, LogOut,
} from "lucide-react";
import { COMPANY } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Products", url: "/products", icon: Box },
  { title: "Transactions", url: "/transactions", icon: CreditCard },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { logout } = useAuth();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const renderGroup = (label: string, items: typeof navItems) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Drumstick className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{COMPANY.shortName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">Farm Management</p>
            </div>
          )}
        </div>

      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Workspace", navItems)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3"
                onClick={() => {
                  void logout();
                }}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
