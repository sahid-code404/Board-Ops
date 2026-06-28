"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { addDays, format, isSameDay } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Printer,
  RefreshCw,
  Utensils,
  UserPlus,
  Users,
  CalendarDays,
  Soup,
  Lock,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import {
  StaggerGroup,
  StaggerItem,
} from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";
import { useAuthStore } from "@/stores/use-auth-store";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type MealCount = {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  startTime: string;
  endTime: string;
  on: number;
  off: number;
  guests: number;
  total: number;
};

type KitchenResponse = {
  date: string;
  counts: MealCount[];
  access?: boolean;
};

type ApiResponse<T> = { success: boolean; data: T };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function KitchenView() {
  const user = useAuthStore((s) => s.user);
  const [date, setDate] = useState<Date>(new Date());

  const dateStr = toDateString(date);
  const isUser = user?.role === "USER";

  const { data: resp, isLoading, isFetching } = useQuery({
    queryKey: ["kitchen", dateStr],
    queryFn: () =>
      api.get<ApiResponse<KitchenResponse>>("/kitchen", {
        params: { date: dateStr },
      }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    enabled: !isUser,
  });

  const counts = resp?.data?.counts ?? [];

  const totals = useMemo(() => {
    return {
      meals: counts.reduce((s, c) => s + c.on + c.guests, 0),
      guests: counts.reduce((s, c) => s + c.guests, 0),
      off: counts.reduce((s, c) => s + c.off, 0),
    };
  }, [counts]);

  // USER role or server denied access — kitchen is admin/manager only
  if (isUser || resp?.data?.access === false) {
    return <AccessRestricted />;
  }

  if (isLoading) return <KitchenSkeleton />;

  return (
    <StaggerGroup className="space-y-4 md:space-y-6">
      {/* Header + Date picker */}
      <StaggerItem>
        <GlassCard className="p-4 md:p-6" hover={false} glow="primary">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Kitchen Dashboard
              </p>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                Live Meal Counts
              </h2>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <RefreshCw
                  className={cn("h-3 w-3", isFetching && "animate-spin")}
                />
                Auto-refreshes every 15s
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <GlassButton
                variant="secondary"
                size="icon"
                onClick={() => setDate((d) => addDays(d, -1))}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </GlassButton>
              <div className="glass-soft rounded-2xl px-4 py-2 min-w-[150px] text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(date, "EEEE")}
                </div>
                <div className="text-sm font-semibold">
                  {format(date, "d MMM yyyy")}
                </div>
              </div>
              <GlassButton
                variant="secondary"
                size="icon"
                onClick={() => setDate((d) => addDays(d, 1))}
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </GlassButton>
              {!isSameDay(date, new Date()) && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setDate(new Date())}
                >
                  Today
                </GlassButton>
              )}
              <GlassButton
                variant="primary"
                size="md"
                onClick={() => toast.success("Printing...")}
              >
                <Printer className="h-4 w-4" />
                Print
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </StaggerItem>

      {/* KPI cards */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <KpiCard
            icon={Utensils}
            label="Total Meals"
            value={totals.meals}
            color="success"
            sub="ON + Guests"
          />
          <KpiCard
            icon={UserPlus}
            label="Guests"
            value={totals.guests}
            color="primary"
            sub="External"
          />
          <KpiCard
            icon={Users}
            label="Meals OFF"
            value={totals.off}
            color="warning"
            sub="Skipped"
          />
        </div>
      </StaggerItem>

      {/* Empty state */}
      {counts.length === 0 ? (
        <StaggerItem>
          <GlassCard className="p-10 md:p-14 text-center" hover={false}>
            <div className="grid place-items-center h-16 w-16 rounded-3xl bg-muted/40 mx-auto mb-4">
              <Soup className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No meals configured</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              No active meal configurations found for{" "}
              {format(date, "d MMM yyyy")}. Set up meals in the Meals section to
              see kitchen counts here.
            </p>
          </GlassCard>
        </StaggerItem>
      ) : (
        <>
          {/* Per-meal cards */}
          <StaggerItem>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {counts.map((m) => (
                <MealCard key={m.id} meal={m} />
              ))}
            </div>
          </StaggerItem>

          {/* Bar chart */}
          <StaggerItem>
            <GlassCard className="p-5 md:p-6" hover={false}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-lg">Counts Comparison</h3>
                  <p className="text-xs text-muted-foreground">
                    ON vs OFF vs Guests per meal
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Legend2 color="var(--success)" label="ON" />
                  <Legend2 color="var(--muted-foreground)" label="OFF" />
                  <Legend2 color="var(--primary)" label="Guests" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={counts}
                  margin={{ top: 8, right: 8, left: -16, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="displayName"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      color: "var(--foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="on"
                    name="ON"
                    fill="var(--success)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={900}
                    maxBarSize={48}
                  />
                  <Bar
                    dataKey="off"
                    name="OFF"
                    fill="var(--muted-foreground)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1100}
                    maxBarSize={48}
                  />
                  <Bar
                    dataKey="guests"
                    name="Guests"
                    fill="var(--primary)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1300}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </StaggerItem>
        </>
      )}
    </StaggerGroup>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: typeof Utensils;
  label: string;
  value: number;
  color: "primary" | "success" | "warning";
  sub: string;
}) {
  const colorVar =
    color === "primary"
      ? "var(--primary)"
      : color === "success"
        ? "var(--success)"
        : "var(--warning)";
  return (
    <GlassCard
      className="p-4 md:p-5 relative overflow-hidden"
      glow={color}
      whileHover={{ y: -2 }}
    >
      <div
        className="absolute -top-8 -right-8 h-24 w-24 rounded-full blur-3xl opacity-30"
        style={{ background: colorVar }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div
            className="grid place-items-center h-9 w-9 md:h-10 md:w-10 rounded-2xl"
            style={{
              background: `color-mix(in oklch, ${colorVar} 18%, transparent)`,
            }}
          >
            <Icon
              className="h-4 w-4 md:h-5 md:w-5"
              style={{ color: colorVar }}
            />
          </div>
        </div>
        <p className="text-[11px] md:text-xs text-muted-foreground">{label}</p>
        <div className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
          <AnimatedCounter value={value} />
        </div>
        <p className="text-[10px] md:text-[11px] text-muted-foreground mt-1">
          {sub}
        </p>
      </div>
    </GlassCard>
  );
}

function MealCard({ meal }: { meal: MealCount }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="relative rounded-3xl p-5 overflow-hidden glass"
      style={{
        background: `linear-gradient(135deg, ${meal.color}30 0%, ${meal.color}0a 55%, transparent 100%)`,
        borderColor: `${meal.color}50`,
        boxShadow: `0 8px 32px -10px ${meal.color}40, inset 0 1px 0 0 ${meal.color}25`,
      }}
    >
      <div
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{ background: meal.color }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="text-4xl drop-shadow-sm">{meal.icon}</div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Service
            </div>
            <div className="text-xs font-medium tabular-nums">
              {meal.startTime} – {meal.endTime}
            </div>
          </div>
        </div>
        <h4 className="font-semibold text-base">{meal.displayName}</h4>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              ON count
            </div>
            <AnimatedCounter
              value={meal.on}
              className="text-4xl font-bold tracking-tight tabular-nums block leading-none"
            />
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              OFF: <strong className="tabular-nums">{meal.off}</strong>
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: `${meal.color}25`,
                color: meal.color,
              }}
            >
              Guests:{" "}
              <strong className="tabular-nums">{meal.guests}</strong>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">
              Total:{" "}
              <strong className="tabular-nums">{meal.total}</strong>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────

function AccessRestricted() {
  return (
    <div className="grid place-items-center min-h-[60vh] p-4">
      <StaggerGroup className="w-full max-w-md">
        <StaggerItem>
          <GlassCard
            className="p-8 md:p-10 text-center"
            glow="warning"
            hover={false}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="grid place-items-center h-16 w-16 rounded-3xl bg-warning/15 mx-auto mb-5"
            >
              <Lock className="h-8 w-8 text-warning" />
            </motion.div>
            <h2 className="text-xl md:text-2xl font-bold mb-2">
              Access restricted
            </h2>
            <p className="text-sm text-muted-foreground">
              The Kitchen Dashboard is available to{" "}
              <strong className="text-foreground">managers and admins</strong>{" "}
              only. Residents don&apos;t have access to live meal counts.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              If you believe this is a mistake, please contact your
              administrator.
            </p>
          </GlassCard>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}

function KitchenSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <ShimmerSkeleton className="h-32 md:h-28" />
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <ShimmerSkeleton className="h-28 md:h-32" />
        <ShimmerSkeleton className="h-28 md:h-32" />
        <ShimmerSkeleton className="h-28 md:h-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="h-44" />
        ))}
      </div>
      <ShimmerSkeleton className="h-72" />
    </div>
  );
}
