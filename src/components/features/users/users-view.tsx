"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  Users as UsersIcon,
  UserCheck,
  UserPlus,
  UserX,
  Search,
  MoreVertical,
  CheckCircle2,
  Ban,
  Power,
  Archive,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
  Mail,
  Phone,
  DoorOpen,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput, GlassTextarea } from "@/components/glass/glass-input";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import { StaggerGroup, StaggerItem } from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore, type Role } from "@/stores/use-auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UserStatus = "PENDING" | "APPROVED" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  room?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
};

type Action =
  | "APPROVE"
  | "SUSPEND"
  | "ACTIVATE"
  | "DEACTIVATE"
  | "ARCHIVE"
  | "RESTORE"
  | "ASSIGN_ROLE";

const STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-warning/15 text-warning" },
  APPROVED: { label: "Approved", className: "bg-success/15 text-success" },
  ACTIVE: { label: "Active", className: "bg-success/15 text-success" },
  INACTIVE: { label: "Inactive", className: "bg-muted text-muted-foreground" },
  SUSPENDED: { label: "Suspended", className: "bg-destructive/15 text-destructive" },
  ARCHIVED: { label: "Archived", className: "bg-muted text-muted-foreground" },
};

const ROLE_META: Record<Role, { label: string; className: string }> = {
  ADMIN: { label: "Admin", className: "bg-primary/15 text-primary" },
  USER: { label: "Resident", className: "bg-muted text-muted-foreground" },
};

const STATUS_FILTERS: { key: UserStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ACTIVE", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "ARCHIVED", label: "Archived" },
];

const ACTIONS_NEED_REASON: Action[] = ["SUSPEND", "DEACTIVATE", "ARCHIVE"];

async function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  const res = await promise;
  if (res && typeof res === "object" && "success" in res && "data" in (res as Record<string, unknown>)) {
    return (res as { data: T }).data;
  }
  return res as T;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-indigo-500 to-purple-500",
];

function gradientFor(name: string) {
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

export function UsersView() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "ALL">("ALL");
  const [confirm, setConfirm] = useState<{ user: ManagedUser; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [assignRole, setAssignRole] = useState<ManagedUser | null>(null);
  const [newRole, setNewRole] = useState<Role>("USER");
  const [assignReason, setAssignReason] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", { search, status }],
    queryFn: () =>
      unwrap<ManagedUser[]>(
        api.get("/users", {
          params: { q: search, status: status === "ALL" ? undefined : status },
        })
      ),
    enabled: isAdmin,
    placeholderData: (prev) => prev,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, role: r, reason: rs }: { id: string; action: Action; role?: Role; reason?: string }) =>
      unwrap<ManagedUser>(api.patch(`/users/${id}`, { action, role: r, reason: rs })),
    onMutate: async ({ id, action, role: r }) => {
      await qc.cancelQueries({ queryKey: ["users"] });
      const prev = qc.getQueryData<ManagedUser[]>(["users", { search, status }]);
      if (prev) {
        const next = prev.map((u) => {
          if (u.id !== id) return u;
          let nextStatus = u.status;
          let nextRole = u.role;
          if (action === "APPROVE" || action === "ACTIVATE" || action === "RESTORE") nextStatus = "ACTIVE";
          if (action === "SUSPEND") nextStatus = "SUSPENDED";
          if (action === "DEACTIVATE") nextStatus = "INACTIVE";
          if (action === "ARCHIVE") nextStatus = "ARCHIVED";
          if (action === "ASSIGN_ROLE" && r) nextRole = r;
          return { ...u, status: nextStatus, role: nextRole };
        });
        qc.setQueryData<ManagedUser[]>(["users", { search, status }], next);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["users", { search, status }], ctx.prev);
      toast.error("Action failed");
    },
    onSuccess: (_u, vars) => {
      const labels: Record<Action, string> = {
        APPROVE: "approved",
        SUSPEND: "suspended",
        ACTIVATE: "activated",
        DEACTIVATE: "deactivated",
        ARCHIVE: "archived",
        RESTORE: "restored",
        ASSIGN_ROLE: "role updated",
      };
      toast.success(`User ${labels[vars.action]}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const pending = users.filter((u) => u.status === "PENDING").length;
    const suspended = users.filter((u) => u.status === "SUSPENDED").length;
    return { total, active, pending, suspended };
  }, [users]);

  if (!isAdmin) {
    return (
      <GlassCard className="p-10 text-center" hover={false}>
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Admins only</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You need administrator privileges to manage users.
        </p>
      </GlassCard>
    );
  }

  const handleAction = (user: ManagedUser, action: Action) => {
    if (action === "ASSIGN_ROLE") {
      setNewRole(user.role);
      setAssignReason("");
      setAssignRole(user);
      return;
    }
    if (ACTIONS_NEED_REASON.includes(action)) {
      setReason("");
      setConfirm({ user, action });
      return;
    }
    actionMutation.mutate({ id: user.id, action });
  };

  const submitConfirm = () => {
    if (!confirm) return;
    if (ACTIONS_NEED_REASON.includes(confirm.action) && !reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    actionMutation.mutate({ id: confirm.user.id, action: confirm.action, reason });
    setConfirm(null);
    setReason("");
  };

  const submitAssignRole = () => {
    if (!assignRole) return;
    actionMutation.mutate({
      id: assignRole.id,
      action: "ASSIGN_ROLE",
      role: newRole,
      reason: assignReason || undefined,
    });
    setAssignRole(null);
    setAssignReason("");
  };

  return (
    <StaggerGroup className="space-y-4 md:space-y-6 pb-6">
      {/* KPIs */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard label="Total Users" value={kpis.total} icon={UsersIcon} color="primary" />
          <KpiCard label="Active" value={kpis.active} icon={UserCheck} color="success" />
          <KpiCard label="Pending Approval" value={kpis.pending} icon={UserPlus} color="warning" />
          <KpiCard label="Suspended" value={kpis.suspended} icon={UserX} color="danger" />
        </div>
      </StaggerItem>

      {/* Search + filter */}
      <StaggerItem>
        <GlassCard className="p-3 md:p-4" hover={false}>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <GlassInput
                placeholder="Search by name, email, phone, or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search />}
              />
            </div>
            <Tabs value={status} onValueChange={(v) => setStatus(v as UserStatus | "ALL")}>
              <TabsList className="bg-muted/40 h-11 p-1 overflow-x-auto no-scrollbar">
                {STATUS_FILTERS.map((f) => (
                  <TabsTrigger
                    key={f.key}
                    value={f.key}
                    className="rounded-2xl text-xs px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </GlassCard>
      </StaggerItem>

      {/* User list */}
      <StaggerItem>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <GlassCard className="p-12 text-center" hover={false}>
            <UsersIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No users match your search.</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {users.map((u) => (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                >
                  <UserRow
                    user={u}
                    onAction={(action) => handleAction(u, action)}
                    canEditRole={role === "ADMIN" && u.role !== "ADMIN"}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </StaggerItem>

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="glass-strong border-border/60 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg capitalize">
              {confirm?.action.toLowerCase()} {confirm?.user.name}?
            </DialogTitle>
            <DialogDescription>
              This action will change the user's status to{" "}
              <span className="font-medium text-foreground">
                {confirm && actionResultStatus(confirm.action)}
              </span>
              . A reason is required and will be logged.
            </DialogDescription>
          </DialogHeader>
          <GlassTextarea
            label="Reason"
            rows={3}
            placeholder={`Reason for ${confirm?.action.toLowerCase()}…`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <GlassButton variant="ghost" size="md" onClick={() => setConfirm(null)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant={confirm?.action === "SUSPEND" || confirm?.action === "ARCHIVE" ? "danger" : "primary"}
              size="md"
              onClick={submitConfirm}
              loading={actionMutation.isPending}
            >
              Confirm
            </GlassButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign role dialog */}
      <Dialog open={!!assignRole} onOpenChange={(v) => !v && setAssignRole(null)}>
        <DialogContent className="glass-strong border-border/60 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Change the role for{" "}
              <span className="font-medium text-foreground">{assignRole?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 ml-1 block text-xs font-medium text-muted-foreground">Role</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger className="w-full glass-soft border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Resident</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <GlassTextarea
              label="Reason (optional)"
              rows={2}
              placeholder="Why is this role being assigned?"
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <GlassButton variant="ghost" size="md" onClick={() => setAssignRole(null)}>
              Cancel
            </GlassButton>
            <GlassButton variant="primary" size="md" onClick={submitAssignRole} loading={actionMutation.isPending}>
              <ShieldCheck className="h-4 w-4" />
              Assign Role
            </GlassButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaggerGroup>
  );
}

function actionResultStatus(action: Action): string {
  switch (action) {
    case "APPROVE":
    case "ACTIVATE":
    case "RESTORE":
      return "Active";
    case "SUSPEND":
      return "Suspended";
    case "DEACTIVATE":
      return "Inactive";
    case "ARCHIVE":
      return "Archived";
    default:
      return "";
  }
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof UsersIcon;
  color: "primary" | "success" | "warning" | "danger";
}) {
  const colorClass = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
  }[color];
  return (
    <GlassCard className="p-4 md:p-5" glow={color}>
      <div className={cn("grid place-items-center h-10 w-10 rounded-2xl mb-3", colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-2xl md:text-3xl font-bold tracking-tight">
        <AnimatedCounter value={value} />
      </div>
    </GlassCard>
  );
}

function UserRow({
  user,
  onAction,
  canEditRole,
}: {
  user: ManagedUser;
  onAction: (a: Action) => void;
  canEditRole: boolean;
}) {
  const sMeta = STATUS_META[user.status];
  const rMeta = ROLE_META[user.role];

  const actions: { action: Action; label: string; icon: typeof CheckCircle2; variant?: "destructive" }[] = [];
  switch (user.status) {
    case "PENDING":
      actions.push({ action: "APPROVE", label: "Approve", icon: CheckCircle2 });
      actions.push({ action: "DEACTIVATE", label: "Reject", icon: Ban, variant: "destructive" });
      break;
    case "ACTIVE":
      actions.push({ action: "SUSPEND", label: "Suspend", icon: Ban, variant: "destructive" });
      actions.push({ action: "DEACTIVATE", label: "Deactivate", icon: Power });
      actions.push({ action: "ARCHIVE", label: "Archive", icon: Archive });
      if (canEditRole) actions.push({ action: "ASSIGN_ROLE", label: "Assign Role", icon: ShieldCheck });
      break;
    case "SUSPENDED":
      actions.push({ action: "ACTIVATE", label: "Activate", icon: Power });
      actions.push({ action: "ARCHIVE", label: "Archive", icon: Archive });
      break;
    case "INACTIVE":
      actions.push({ action: "ACTIVATE", label: "Activate", icon: Power });
      actions.push({ action: "ARCHIVE", label: "Archive", icon: Archive });
      break;
    case "ARCHIVED":
      actions.push({ action: "RESTORE", label: "Restore", icon: RotateCcw });
      break;
    case "APPROVED":
      actions.push({ action: "ACTIVATE", label: "Activate", icon: Power });
      break;
  }

  return (
    <GlassCard className="p-4 md:p-5" hover={false}>
      <div className="flex items-start gap-3 md:gap-4">
        <Avatar className="h-12 w-12 md:h-14 md:w-14 rounded-2xl">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
          <AvatarFallback className={cn("rounded-2xl bg-gradient-to-br text-white font-semibold", gradientFor(user.name))}>
            {initials(user.name) || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{user.name}</h3>
                <Badge variant="outline" className={cn("text-[10px]", rMeta.className)}>
                  {rMeta.label}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px]", sMeta.className)}>
                  {sMeta.label}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3" /> {user.email}
                </span>
                {user.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {user.phone}
                  </span>
                )}
                {user.room && (
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3 w-3" /> {user.room}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                <span>Joined {format(new Date(user.createdAt), "MMM d, yyyy")}</span>
                {user.lastLoginAt && (
                  <span>· Last login {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}</span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassButton variant="ghost" size="icon" className="shrink-0" aria-label="User actions">
                  <MoreVertical className="h-4 w-4" />
                </GlassButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-2xl">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <DropdownMenuItem
                      key={a.action}
                      onClick={() => onAction(a.action)}
                      variant={a.variant}
                      className="rounded-xl cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {a.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
