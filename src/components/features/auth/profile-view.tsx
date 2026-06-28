"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Mail,
  Phone,
  DoorOpen,
  ShieldCheck,
  CalendarDays,
  Clock,
  Globe,
  Palette,
  Languages,
  Activity,
  Pencil,
  User,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { StaggerGroup, StaggerItem } from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore, type Role, type CurrentUser } from "@/stores/use-auth-store";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UserStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "ARCHIVED" | "INACTIVE";

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-success/15 text-success" },
  PENDING: { label: "Pending", className: "bg-warning/15 text-warning" },
  SUSPENDED: { label: "Suspended", className: "bg-destructive/15 text-destructive" },
  ARCHIVED: { label: "Archived", className: "bg-muted text-muted-foreground" },
  INACTIVE: { label: "Inactive", className: "bg-muted text-muted-foreground" },
};

const ROLE_META: Record<Role, { label: string; className: string }> = {
  SUPER_ADMIN: { label: "Super Admin", className: "bg-primary/15 text-primary" },
  ADMIN: { label: "Admin", className: "bg-primary/15 text-primary" },
  MANAGER: { label: "Manager", className: "bg-info/15 text-info" },
  USER: { label: "Resident", className: "bg-muted text-muted-foreground" },
};

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

async function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  const res = await promise;
  if (res && typeof res === "object" && "success" in res && "data" in (res as Record<string, unknown>)) {
    return (res as { data: T }).data;
  }
  return res as T;
}

type MeUser = CurrentUser & {
  status: UserStatus;
  createdAt?: string;
  lastLoginAt?: string | null;
  theme?: string | null;
};

export function ProfileView() {
  const stored = useAuthStore((s) => s.user);
  const { theme } = useTheme();

  const { data: me, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => unwrap<MeUser>(api.get("/auth/me")),
    initialData: stored as MeUser | undefined,
  });

  if (isLoading || !me) {
    return (
      <div className="space-y-4">
        <ShimmerSkeleton className="h-44" />
        <div className="grid md:grid-cols-2 gap-4">
          <ShimmerSkeleton className="h-48" />
          <ShimmerSkeleton className="h-48" />
        </div>
      </div>
    );
  }

  const sMeta = STATUS_META[me.status] ?? STATUS_META.ACTIVE;
  const rMeta = ROLE_META[me.role];
  const joined = (me as MeUser & { createdAt?: string }).createdAt
    ? format(new Date((me as MeUser & { createdAt?: string }).createdAt as string), "MMM d, yyyy")
    : "—";
  const lastLogin = (me as MeUser & { lastLoginAt?: string | null }).lastLoginAt
    ? formatDistanceToNow(new Date((me as MeUser & { lastLoginAt?: string | null }).lastLoginAt as string), { addSuffix: true })
    : "First login";

  return (
    <StaggerGroup className="space-y-4 md:space-y-6 pb-6">
      {/* Profile Header */}
      <StaggerItem>
        <GlassCard className="p-6 md:p-8 relative overflow-hidden" hover={false} glow="primary">
          <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none">
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary/40 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-success/30 blur-3xl" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-7">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="relative shrink-0 mx-auto md:mx-0"
            >
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary/40 to-success/40 blur-md" />
              <Avatar className="relative h-24 w-24 md:h-28 md:w-28 rounded-3xl">
                {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt={me.name} />}
                <AvatarFallback
                  className={cn(
                    "rounded-3xl bg-gradient-to-br text-white font-bold text-2xl md:text-3xl",
                    gradientFor(me.name)
                  )}
                >
                  {initials(me.name) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full glass-strong grid place-items-center ring-2 ring-background">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </span>
            </motion.div>

            <div className="flex-1 min-w-0 text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <h2 className="text-2xl md:text-3xl font-bold truncate">{me.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{me.email}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap justify-center md:justify-start">
                  <Badge variant="outline" className={cn("text-xs", rMeta.className)}>
                    <ShieldCheck className="h-3 w-3" />
                    {rMeta.label}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", sMeta.className)}>
                    {sMeta.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-muted/60 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    Member since {joined}
                  </Badge>
                </div>
              </motion.div>
            </div>

            <div className="shrink-0">
              <GlassButton
                variant="secondary"
                size="md"
                onClick={() => toast.info("Profile editing coming soon")}
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </StaggerItem>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <StaggerItem>
          <InfoCard
            title="Contact"
            subtitle="How to reach you"
            icon={Mail}
            color="primary"
            rows={[
              { icon: Mail, label: "Email", value: me.email },
              { icon: Phone, label: "Phone", value: me.phone || "—" },
              { icon: DoorOpen, label: "Room", value: me.room || "—" },
              {
                icon: ShieldCheck,
                label: "Emergency Contact",
                value: me.phone || "Not configured",
              },
            ]}
          />
        </StaggerItem>

        <StaggerItem>
          <InfoCard
            title="Preferences"
            subtitle="Display & localization"
            icon={Palette}
            color="success"
            rows={[
              {
                icon: Palette,
                label: "Theme",
                value: theme === "dark" ? "Dark" : "Light",
              },
              { icon: Languages, label: "Language", value: "English (India)" },
              { icon: Globe, label: "Timezone", value: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
              { icon: Activity, label: "Status", value: sMeta.label },
            ]}
          />
        </StaggerItem>
      </div>

      <StaggerItem>
        <InfoCard
          title="Account"
          subtitle="Account & session details"
          icon={User}
          color="warning"
          rows={[
            { icon: ShieldCheck, label: "Role", value: rMeta.label },
            { icon: CheckCircle2, label: "Status", value: sMeta.label },
            { icon: CalendarDays, label: "Member Since", value: joined },
            { icon: Clock, label: "Last Login", value: lastLogin },
          ]}
        />
      </StaggerItem>

      <StaggerItem>
        <GlassCard className="p-5 md:p-6 flex items-start gap-3" hover={false} glow="primary">
          <div className="grid place-items-center h-10 w-10 rounded-2xl bg-primary/15 text-primary shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">More coming soon</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Profile editing, avatar uploads, two-factor authentication, and session management are
              on the way. Stay tuned!
            </p>
          </div>
        </GlassCard>
      </StaggerItem>
    </StaggerGroup>
  );
}

function InfoCard({
  title,
  subtitle,
  icon: Icon,
  color,
  rows,
}: {
  title: string;
  subtitle: string;
  icon: typeof Mail;
  color: "primary" | "success" | "warning";
  rows: { icon: typeof Mail; label: string; value: string }[];
}) {
  const colorClass = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  }[color];
  return (
    <GlassCard className="p-5 md:p-6" hover={false}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("grid place-items-center h-10 w-10 rounded-2xl", colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const RowIcon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0"
            >
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <RowIcon className="h-3.5 w-3.5" />
                {row.label}
              </span>
              <span className="text-sm font-medium text-right truncate max-w-[60%]">{row.value}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
