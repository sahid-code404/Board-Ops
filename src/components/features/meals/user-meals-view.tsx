"use client";

import { useState, useMemo, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, addDays, isSameDay } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
  Utensils,
  Lock,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/glass-card";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import {
  StaggerGroup,
  StaggerItem,
} from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";

// ─────────────────────────────────────────────────────────────
// Types — match the actual /api/meals/entries response shape
// ─────────────────────────────────────────────────────────────

type MealConfig = {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  startTime: string;
  endTime: string;
  cutoffTime: string;
};

type FlatEntry = {
  id: string;
  mealId: string;
  mealName: string;
  mealDisplayName: string;
  mealIcon: string;
  mealColor: string;
  serviceDate: string;
  status: string; // ON | OFF | LOCKED
  editableUntil: string;
  locked: boolean;
  overrideFlag: boolean;
  startTime: string;
  endTime: string;
  mealType: string;
};

/** Normalized entry with nested meal config (for clean rendering). */
type MealEntry = {
  id: string;
  status: string;
  locked: boolean;
  editableUntil: string;
  meal: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
    startTime: string;
    endTime: string;
    cutoffTime: string;
  };
};

type EntriesResponse = {
  meals: MealConfig[];
  byDate: Record<string, FlatEntry[]>;
};

type ApiResponse<T> = { success: boolean; data: T };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Local-time YYYY-MM-DD (matches kitchen-view convention to avoid TZ drift). */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert "HH:mm" to "h:mm AM/PM" */
function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function UserMealsView() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isToday = isSameDay(selectedDate, new Date());

  const dateStr = toDateString(selectedDate);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["user-meals", dateStr],
    queryFn: async () => {
      const r = await api.get<ApiResponse<EntriesResponse>>("/meals/entries", {
        params: { date: dateStr },
      });
      const flat = r.data.byDate[dateStr] ?? [];
      const mealMap = new Map(r.data.meals.map((m) => [m.id, m]));
      return flat.map<MealEntry>((f) => {
        const meal = mealMap.get(f.mealId);
        return {
          id: f.id,
          status: f.status,
          locked: f.locked,
          editableUntil: f.editableUntil,
          meal: {
            id: f.mealId,
            name: f.mealName,
            displayName: f.mealDisplayName,
            icon: f.mealIcon,
            color: f.mealColor,
            startTime: f.startTime,
            endTime: f.endTime,
            cutoffTime: meal?.cutoffTime ?? "",
          },
        };
      });
    },
    placeholderData: (prev) => prev,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      entryId,
      status,
    }: {
      entryId: string;
      status: "ON" | "OFF";
    }) => {
      await api.patch("/meals/toggle", { entryId, status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-meals"] });
      qc.invalidateQueries({ queryKey: ["kitchen"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to toggle meal"),
  });

  const stats = useMemo(() => {
    const on = entries.filter(
      (e) => e.status === "ON" || e.status === "LOCKED"
    ).length;
    const off = entries.filter((e) => e.status === "OFF").length;
    const locked = entries.filter(
      (e) => e.locked || e.status === "LOCKED"
    ).length;
    return { on, off, locked, total: entries.length };
  }, [entries]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ShimmerSkeleton className="h-14 w-full" />
        <div className="grid-kpi gap-3">
          <ShimmerSkeleton className="h-28" />
          <ShimmerSkeleton className="h-28" />
          <ShimmerSkeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <StaggerGroup className="space-y-4 pb-6">
      {/* Date picker — same capsule design as kitchen */}
      <StaggerItem>
        <div className="flex items-center justify-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            aria-label="Previous day"
            className="grid place-items-center h-10 w-10 rounded-full glass-strong shrink-0 ring-1 ring-border/40 hover:ring-primary/40 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>

          <button
            onClick={() => !isToday && setSelectedDate(new Date())}
            className="flex-1 max-w-[280px] flex items-center justify-center gap-2.5 glass-soft rounded-full px-6 py-2.5 transition-all hover:ring-1 hover:ring-primary/30"
          >
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <div className="leading-tight text-center">
              <p className="text-sm font-bold text-primary">
                {isToday ? "Today" : format(selectedDate, "d MMM")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {format(selectedDate, "EEE, d MMM yyyy")}
              </p>
            </div>
            {!isToday && (
              <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            aria-label="Next day"
            className="grid place-items-center h-10 w-10 rounded-full glass-strong shrink-0 ring-1 ring-border/40 hover:ring-primary/40 transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </StaggerItem>

      {/* KPI cards — ON / OFF / Locked */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-4" glow="success" hover={false}>
            <div className="grid place-items-center h-10 w-10 rounded-2xl bg-success/15 text-success mb-3">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">Meals ON</p>
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedCounter value={stats.on} />
            </div>
          </GlassCard>
          <GlassCard className="p-4" glow="warning" hover={false}>
            <div className="grid place-items-center h-10 w-10 rounded-2xl bg-warning/15 text-warning mb-3">
              <X className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">Meals OFF</p>
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedCounter value={stats.off} />
            </div>
          </GlassCard>
          <GlassCard className="p-4" glow="danger" hover={false}>
            <div className="grid place-items-center h-10 w-10 rounded-2xl bg-destructive/15 text-destructive mb-3">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">Locked</p>
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedCounter value={stats.locked} />
            </div>
          </GlassCard>
        </div>
      </StaggerItem>

      {/* Meal cards */}
      <StaggerItem>
        {entries.length === 0 ? (
          <GlassCard className="p-10 text-center" hover={false}>
            <Utensils className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No meals configured for this date.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {entries.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                >
                  <MealCard
                    entry={entry}
                    onToggle={(newStatus) =>
                      toggleMutation.mutate({
                        entryId: entry.id,
                        status: newStatus,
                      })
                    }
                    loading={toggleMutation.isPending}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </StaggerItem>
    </StaggerGroup>
  );
}

const MealCard = memo(function MealCard({
  entry,
  onToggle,
  loading,
}: {
  entry: MealEntry;
  onToggle: (status: "ON" | "OFF") => void;
  loading: boolean;
}) {
  const isOn = entry.status === "ON" || entry.status === "LOCKED";
  const isLocked = entry.locked || entry.status === "LOCKED";

  return (
    <GlassCard className="p-4" hover={false}>
      <div className="flex items-center gap-3">
        {/* Meal icon */}
        <div
          className="grid place-items-center h-12 w-12 rounded-2xl shrink-0 text-2xl"
          style={{
            background: `color-mix(in oklch, ${entry.meal.color} 15%, transparent)`,
          }}
        >
          {entry.meal.icon}
        </div>

        {/* Meal info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{entry.meal.displayName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {to12h(entry.meal.startTime)} – {to12h(entry.meal.endTime)}
            </span>
            {isLocked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => !isLocked && onToggle(isOn ? "OFF" : "ON")}
          disabled={isLocked || loading}
          className={cn(
            "relative inline-flex h-8 w-14 items-center rounded-full transition-all shrink-0",
            isOn ? "bg-success shadow-md shadow-success/30" : "bg-muted",
            (isLocked || loading) && "opacity-50 cursor-not-allowed"
          )}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "inline-block h-6 w-6 rounded-full bg-white shadow-md",
              isOn ? "ml-auto mr-1" : "ml-1"
            )}
          />
        </button>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-between mt-3">
        <span
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            isOn
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isLocked ? "🔒 Locked" : isOn ? "ON" : "OFF"}
        </span>
        {!isLocked && entry.meal.cutoffTime && (
          <span className="text-[10px] text-muted-foreground">
            Cutoff: {to12h(entry.meal.cutoffTime)}
          </span>
        )}
      </div>
    </GlassCard>
  );
});
