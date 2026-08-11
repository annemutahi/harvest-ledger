import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ROLE_LABELS, can, canManageProducts, roleOf } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppRole } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Bell, Camera, KeyRound, ShieldCheck, UserRound, Users } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Profile Settings - Peaceful Acres" }] }),
  component: SettingsPage,
});

const notificationOptions = [
  {
    id: "dueSoon",
    title: "Payments due soon",
    description: "Remind me before customer invoices reach their due date.",
    defaultChecked: true,
  },
  {
    id: "overdue",
    title: "Overdue invoices",
    description: "Alert me when an invoice moves past its due date.",
    defaultChecked: true,
  },
  {
    id: "payments",
    title: "Payments received",
    description: "Notify me when a payment is recorded.",
    defaultChecked: true,
  },
  {
    id: "dailySummary",
    title: "Daily activity summary",
    description: "Send a daily summary of sales, payments, and open credit.",
    defaultChecked: false,
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function SettingsPage() {
  const { user } = useAuth();
  const isManager = canManageProducts(user);
  const canManageUsers = can(user, "users", "change");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(user?.username ?? "{username}");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [auditFilter, setAuditFilter] = useState<{ model: string; action: string; search: string }>({
    model: "",
    action: "",
    search: "",
  });

  const auditQuery = useQuery({
    queryKey: ["audit-logs", auditFilter],
    queryFn: () => api.listAuditLogs(auditFilter),
    enabled: isManager,
    staleTime: 15_000,
  });

  const usersQuery = useQuery({
    queryKey: ["team-users"],
    queryFn: () => api.listUsers(),
    enabled: canManageUsers,
  });

  const matrixQuery = useQuery({
    queryKey: ["role-matrix"],
    queryFn: () => api.roleMatrix(),
    enabled: canManageUsers,
    staleTime: 5 * 60_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number | string; role: AppRole }) =>
      api.setUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      toast.success("Role updated.");
    },
    onError: () => toast.error("Could not update that role."),
  });

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
    toast.success("Profile photo selected.");
  };

  const saveProfile = () => {
    toast.success("Profile settings saved locally.");
  };

  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated. Use it the next time you sign in.");
    },
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not update your password.",
      ),
  });

  const changePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      toast.error("New password does not meet all the requirements below.");
      return;
    }
    passwordMutation.mutate();
  };


  return (
    <AppShell
      title="Profile Settings"
      description="Manage your account details, password, photo, and notification preferences."
    >
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profile">
            <UserRound className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password">
            <KeyRound className="mr-2 h-4 w-4" />
            Password
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          {canManageUsers && (
            <TabsTrigger value="roles">
              <Users className="mr-2 h-4 w-4" />
              Roles
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="audit">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Audit log
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={photoUrl} alt={name} />
                  <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handlePhotoChange(event.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="mr-2 h-4 w-4" />
                    Change Photo
                  </Button>
                  <p className="text-xs text-muted-foreground">Use a square image for the cleanest crop.</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 700 000 000" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={ROLE_LABELS[roleOf(user) ?? "viewer"] ?? "—"}
                    disabled
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile}>Save Profile</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent className="max-w-xl space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <PasswordInput
                  id="current-password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <PasswordStrength password={newPassword} confirm={confirmPassword} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <FieldError
                  message={
                    confirmPassword && confirmPassword !== newPassword
                      ? "The two passwords don't match."
                      : undefined
                  }
                />
              </div>
              <Button
                onClick={changePassword}
                disabled={
                  passwordMutation.isPending ||
                  !currentPassword ||
                  !isStrongPassword(newPassword) ||
                  newPassword !== confirmPassword
                }
              >
                {passwordMutation.isPending ? "Updating…" : "Update Password"}
              </Button>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationOptions.map((option, index) => (
                <div key={option.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    <Switch defaultChecked={option.defaultChecked} aria-label={option.title} />
                  </div>
                  {index < notificationOptions.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={() => toast.success("Notification preferences saved locally.")}>
                  Save Notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Team roles &amp; module rights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="w-56">Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                            Loading team…
                          </TableCell>
                        </TableRow>
                      )}
                      {usersQuery.data?.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.username}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {member.email || "—"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={roleOf(member) ?? "viewer"}
                              onValueChange={(value) =>
                                roleMutation.mutate({ id: member.id, role: value as AppRole })
                              }
                              disabled={roleMutation.isPending}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(matrixQuery.data?.roles ?? []).map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {matrixQuery.data && (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Module</TableHead>
                          {matrixQuery.data.roles.map((role) => (
                            <TableHead key={role.value}>{role.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matrixQuery.data.modules.map((module) => (
                          <TableRow key={module}>
                            <TableCell className="text-xs font-medium capitalize">{module}</TableCell>
                            {matrixQuery.data!.roles.map((role) => {
                              const actions = matrixQuery.data!.matrix[role.value]?.[module] ?? [];
                              return (
                                <TableCell key={role.value} className="text-xs">
                                  {actions.length === 0 ? (
                                    <span className="text-muted-foreground">No access</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {actions.map((action) => (
                                        <Badge key={action} variant="outline" className="capitalize">
                                          {action}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Rights are enforced on the server for every module; changing a role takes effect
                  the next time that user loads the app.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1">
                    <Label htmlFor="audit-model" className="text-xs">Model</Label>
                    <Input
                      id="audit-model"
                      placeholder="e.g. Customer"
                      value={auditFilter.model}
                      onChange={(e) => setAuditFilter((f) => ({ ...f, model: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="audit-action" className="text-xs">Action</Label>
                    <Input
                      id="audit-action"
                      placeholder="create / update / delete"
                      value={auditFilter.action}
                      onChange={(e) => setAuditFilter((f) => ({ ...f, action: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="audit-search" className="text-xs">Search</Label>
                    <Input
                      id="audit-search"
                      placeholder="Object or user"
                      value={auditFilter.search}
                      onChange={(e) => setAuditFilter((f) => ({ ...f, search: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Object</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            Loading…
                          </TableCell>
                        </TableRow>
                      )}
                      {auditQuery.data?.length === 0 && !auditQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            No audit events match these filters.
                          </TableCell>
                        </TableRow>
                      )}
                      {auditQuery.data?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDate(log.timestamp)}
                          </TableCell>
                          <TableCell className="text-xs">{log.username || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.model}</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium">{log.objectRepr || log.objectId}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.ipAddress || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing the most recent {auditQuery.data?.length ?? 0} events. Records are immutable
                  and retained for compliance and rollback.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </AppShell>
  );
}
