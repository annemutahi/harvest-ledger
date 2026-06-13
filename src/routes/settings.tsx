import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — GreenHarvest" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell title="Settings" description="Manage your profile and farm-wide preferences.">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>User Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary text-primary-foreground">FM</AvatarFallback></Avatar>
                <Button variant="outline">Change photo</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><Label>Full Name</Label><Input defaultValue="Farm Manager" /></div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" defaultValue="manager@greenharvest.farm" /></div>
                <div className="grid gap-2"><Label>Phone</Label><Input defaultValue="+254 700 000 000" /></div>
                <div className="grid gap-2"><Label>Role</Label><Input defaultValue="Administrator" disabled /></div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="grid gap-2"><Label>Current Password</Label><Input type="password" /></div>
              <div className="grid gap-2"><Label>New Password</Label><Input type="password" /></div>
              <div className="grid gap-2"><Label>Confirm Password</Label><Input type="password" /></div>
              <Button>Update Password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                ["Overdue invoice alerts", "Email when an invoice becomes overdue."],
                ["Payment received", "Notify me whenever a payment is recorded."],
                ["Daily sales summary", "Receive a daily summary at 8pm."],
                ["Low stock warnings", "Alert when a product runs low."],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0"><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><Label>Farm Name</Label><Input defaultValue="GreenHarvest Farms Ltd." /></div>
                <div className="grid gap-2"><Label>Tax ID</Label><Input defaultValue="P051234567X" /></div>
                <div className="grid gap-2 sm:col-span-2"><Label>Address</Label><Input defaultValue="Limuru Road, Kiambu County, Kenya" /></div>
                <div className="grid gap-2"><Label>Phone</Label><Input defaultValue="+254 711 222 333" /></div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" defaultValue="accounts@greenharvest.farm" /></div>
              </div>
              <Button>Save Company Info</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
