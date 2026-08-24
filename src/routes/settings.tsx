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
import { PasswordInput } from "@/components/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordStrength, isStrongPassword } from "@/components/password-strength";
import { FieldError } from "@/components/field-error";

import { formatDate } from "@/lib/format";
import { Bell, Camera, KeyRound, ShieldCheck, UserRound, Users } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Profile Settings" }] }),
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
  const canViewUsers = can(user, "users", "view");
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
  const canAddUsers = can(user, "users", "add");
  const [newUser, setNewUser] = useState<{
    username: string;
    email: string;
    password: string;
    confirm: string;
    role: AppRole;
  }>({ username: "", email: "", password: "", confirm: "", role: "sales" });
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
    enabled: canViewUsers,
  });

  const matrixQuery = useQuery({
    queryKey: ["role-matrix"],
    queryFn: () => api.roleMatrix(),
    enabled: canViewUsers,
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

  const [resetTarget, setResetTarget] = useState<{ id: number | string; username: string } | null>(
    null,
  );
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number | string; password: string }) =>
      api.resetUserPassword(id, password),
    onSuccess: (data) => {
      toast.success(data?.detail || "Password reset.");
      setResetTarget(null);
      setResetPassword("");
      setResetConfirm("");
    },
    onError: (error: any) => toast.error(error?.message || "Could not reset that password."),
  });

  const submitResetPassword = () => {
    if (!resetTarget) return;
    if (!isStrongPassword(resetPassword)) {
      toast.error("Choose a stronger password.");
      return;
    }
    if (resetPassword !== resetConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    resetPasswordMutation.mutate({ id: resetTarget.id, password: resetPassword });
  };

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number | string; isActive: boolean }) =>
      api.setUserActive(id, isActive),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      toast.success(vars.isActive ? "User activated." : "User deactivated.");
    },
    onError: (error: any) =>
      toast.error(error?.message || "Could not update that user's status."),
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
      toast.error("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      toast.error("New password does not meet all the requirements below.");
      return;
    }
    passwordMutation.mutate();
  };

  const createUserMutation = useMutation({
    mutationFn: () =>
      api.createUser({
        username: newUser.username.trim(),
        email: newUser.email.trim() || undefined,
        password: newUser.password,
        role: newUser.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      setNewUser({ username: "", email: "", password: "", confirm: "", role: "sales" });
      toast.success("User created. Share the initial password with them securely.");
    },
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error && error.message ? error.message : "Could not create user.",
      ),
  });

  const submitNewUser = () => {
    if (!newUser.username.trim() || !newUser.password) {
      toast.error("Username and password are required.");
      return;
    }
    if (newUser.password !== newUser.confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(newUser.password)) {
      toast.error("Password does not meet all the requirements.");
      return;
    }
    createUserMutation.mutate();
  };



  return (
    <AppShell
      title="Profile Settings"
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
          {canViewUsers && (
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
                {/* <div className="space-y-2">
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
                </div> */}
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

        {canViewUsers && (
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Team roles &amp; module rights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {canAddUsers && (
                  <div className="space-y-4 rounded-md border p-4">
                    <div>
                      <p className="text-sm font-medium">Add a team member</p>
                      <p className="text-xs text-muted-foreground">
                        Create the account with an initial password. Ask them to change it from
                        Settings → Password after their first sign-in.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-username">Username</Label>
                        <Input
                          id="new-username"
                          value={newUser.username}
                          autoComplete="off"
                          onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-user-email">Email (optional)</Label>
                        <Input
                          id="new-user-email"
                          type="email"
                          value={newUser.email}
                          autoComplete="off"
                          onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-user-password">Initial password</Label>
                        <PasswordInput
                          id="new-user-password"
                          value={newUser.password}
                          autoComplete="new-password"
                          onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-user-confirm">Confirm password</Label>
                        <PasswordInput
                          id="new-user-confirm"
                          value={newUser.confirm}
                          autoComplete="new-password"
                          onChange={(e) => setNewUser((s) => ({ ...s, confirm: e.target.value }))}
                        />
                        <FieldError
                          message={
                            newUser.confirm && newUser.confirm !== newUser.password
                              ? "Passwords do not match."
                              : undefined
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value) =>
                            setNewUser((s) => ({ ...s, role: value as AppRole }))
                          }
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
                      </div>
                    </div>
                    <PasswordStrength password={newUser.password} confirm={newUser.confirm} />
                    <div className="flex justify-end">
                      <Button onClick={submitNewUser} disabled={createUserMutation.isPending}>
                        {createUserMutation.isPending ? "Creating…" : "Create user"}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="w-56">Role</TableHead>
                        <TableHead className="w-40">Status</TableHead>
                        <TableHead className="w-32 text-right">Password</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
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
                              disabled={roleMutation.isPending || !canManageUsers}
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={member.is_active !== false}
                                onCheckedChange={(checked) =>
                                  activeMutation.mutate({ id: member.id, isActive: checked })
                                }
                                disabled={
                                  activeMutation.isPending ||
                                  !canManageUsers ||
                                  String(member.id) === String(user?.id)
                                }
                                aria-label={`Toggle access for ${member.username}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {member.is_active === false ? "Inactive" : "Active"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canManageUsers}
                              onClick={() => {
                                setResetPassword("");
                                setResetConfirm("");
                                setResetTarget({ id: member.id, username: member.username });
                              }}
                            >
                              Reset
                            </Button>
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
                <Dialog
                  open={resetTarget !== null}
                  onOpenChange={(open) => {
                    if (!open) setResetTarget(null);
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset password</DialogTitle>
                      <DialogDescription>
                        Set a temporary password for {resetTarget?.username}. Share it privately and
                        ask them to change it from their profile after signing in.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                      <div className="grid gap-1">
                        <Label htmlFor="reset-new">New password</Label>
                        <PasswordInput
                          id="reset-new"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                        />
                        <PasswordStrength password={resetPassword} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="reset-confirm">Confirm password</Label>
                        <PasswordInput
                          id="reset-confirm"
                          value={resetConfirm}
                          onChange={(e) => setResetConfirm(e.target.value)}
                        />
                        {resetConfirm && resetConfirm !== resetPassword && (
                          <FieldError message="Passwords do not match." />
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setResetTarget(null)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={submitResetPassword}
                        disabled={resetPasswordMutation.isPending}
                      >
                        {resetPasswordMutation.isPending ? "Resetting…" : "Reset password"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

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
