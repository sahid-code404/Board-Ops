"use client";

import { useState, useMemo, memo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { isSameMonth, format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
  Utensils,
  Lock,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import {
  StaggerGroup,
  StaggerItem,
} from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";

// ─────────────────────────────────────────────────────────────
// Types
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
  status: string;
  editableUntil: string;
  locked: boolean;
  overrideFlag: boolean;
  startTime: string;
  endTime: string;
  mealType: string;
};

type MealEntry = {
  id: string;
  status: string;
  locked: boolean;
  editableUntil: string;
  serviceDate: string;
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

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function UserMealsView() {
  const qc = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const isThisMonth = isSameMonth(new Date(selectedYear, selectedMonth, 1), now);
  const [expandedDay, setExpandedDay] = useState<string | null>(toDateString(now));

  const { data: monthData, isLoading } = useQuery({
    queryKey: ["user-meals", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const r = await api.get<ApiResponse<EntriesResponse>>("/meals/entries", {
        params: { month: selectedMonth, year: selectedYear },
      });
      return r.data;
    },
    placeholderData: (prev) => prev,
  });

  // Normalize: build a sorted array of days with their meal entries
  const days = useMemo(() => {
    if (!monthData) return [];
    const mealMap = new Map(monthData.meals.map((m) => [m.id, m]));
    const result: { dateStr: string; date: Date; entries: MealEntry[] }[] = [];

    const dateKeys = Object.keys(monthData.byDate).sort();
    for (const dateStr of dateKeys) {
      const flatEntries = monthData.byDate[dateStr];
      if (!flatEntries || flatEntries.length === 0) continue;
      const entries: MealEntry[] = flatEntries.map((f) => {
        const meal = mealMap.get(f.mealId);
        return {
          id: f.id,
          status: f.status,
          locked: f.locked,
          editableUntil: f.editableUntil,
          serviceDate: f.serviceDate,
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
      result.push({ dateStr, date: parseDateStr(dateStr), entries });
    }
    return result;
  }, [monthData]);

  const toggleMutation = useMutation({
    mutationFn: async ({ entryId, status }: { entryId: string; status: "ON" | "OFF" }) => {
      await api.patch("/meals/toggle", { entryId, status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-meals"] });
      qc.invalidateQueries({ queryKey: ["kitchen"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to toggle meal"),
  });

  // Month-level stats
  const stats = useMemo(() => {
    let on = 0, off = 0, locked = 0;
    for (const day of days) {
      for (const e of day.entries) {
        if (e.status === "ON" || e.status === "LOCKED") on++;
        else if (e.status === "OFF") off++;
        if (e.locked || e.status === "LOCKED") locked++;
      }
    }
    return { on, off, locked };
  }, [days]);

  const handleToggleDay = useCallback((dateStr: string) => {
    setExpandedDay((prev) => (prev === dateStr ? null : dateStr));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ShimmerSkeleton className="h-14 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <ShimmerSkeleton className="h-28" />
          <ShimmerSkeleton className="h-28" />
          <ShimmerSkeleton className="h-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <StaggerGroup className="space-y-4 pb-6">
      {/* Month picker — same capsule design as billing/expenses */}
      <StaggerItem>
        <div className="flex items-center justify-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth - 1, 1);
              setSelectedMonth(d.getMonth());
              setSelectedYear(d.getFullYear());
            }}
            aria-label="Previous month"
            className="grid place-items-center h-10 w-10 rounded-full glass-strong shrink-0 ring-1 ring-border/40 hover:ring-primary/40 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>

          <button
            onClick={() => {
              if (!isThisMonth) {
                setSelectedMonth(now.getMonth());
                setSelectedYear(now.getFullYear());
              }
            }}
            className="flex-1 max-w-[280px] flex items-center justify-center gap-2.5 glass-soft rounded-full px-6 py-2.5 transition-all hover:ring-1 hover:ring-primary/30"
          >
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <div className="leading-tight text-center">
              <p className="text-sm font-bold text-primary">
                {new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "long" })}
              </p>
              <p className="text-[11px] text-muted-foreground">{selectedYear}</p>
            </div>
            {!isThisMonth && (
              <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const d = new Date(selectedYear, selectedMonth + 1, 1);
              setSelectedMonth(d.getMonth());
              setSelectedYear(d.getFullYear());
            }}
            aria-label="Next month"
            className="grid place-items-center h-10 w-10 rounded-full glass-strong shrink-0 ring-1 ring-border/40 hover:ring-primary/40 transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </StaggerItem>

      {/* KPI cards — month totals */}
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

      {/* Agenda — list of days with expandable meal details */}
      <StaggerItem>
        {days.length === 0 ? (
          <GlassCard className="p-10 text-center" hover={false}>
            <Utensils className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No meals configured for {new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {days.map((day) => (
                <motion.div
                  key={day.dateStr}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                >
                  <DayRow
                    dateStr={day.dateStr}
                    date={day.date}
                    entries={day.entries}
                    isExpanded={expandedDay === day.dateStr}
                    onToggleExpand={() => handleToggleDay(day.dateStr)}
                    onToggleMeal={(entryId, status) =>
                      toggleMutation.mutate({ entryId, status })
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

// ─────────────────────────────────────────────────────────────
// Day row — collapsed shows date + summary, expanded shows meal cards
// ─────────────────────────────────────────────────────────────

const DayRow = memo(function DayRow({
  dateStr,
  date,
  entries,
  isExpanded,
  onToggleExpand,
  onToggleMeal,
  loading,
}: {
  dateStr: string;
  date: Date;
  entries: MealEntry[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleMeal: (entryId: string, status: "ON" | "OFF") => void;
  loading: boolean;
}) {
  const isToday = toDateString(new Date()) === dateStr;
  const onCount = entries.filter((e) => e.status === "ON" || e.status === "LOCKED").length;
  const offCount = entries.filter((e) => e.status === "OFF").length;
  const lockedCount = entries.filter((e) => e.locked || e.status === "LOCKED").length;

  return (
    <GlassCard className="overflow-hidden" hover={false}>
      {/* Day header — clickable to expand/collapse */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-3 hover:bg-secondary/20 transition-colors"
      >
        {/* Date badge */}
        <div
          className={cn(
            "grid place-items-center h-11 w-11 rounded-2xl shrink-0 flex-col",
            isToday ? "bg-primary/15" : "bg-muted/40"
          )}
        >
          <span className={cn("text-xs font-bold leading-none", isToday ? "text-primary" : "text-muted-foreground")}>
            {format(date, "EEE").toUpperCase()}
          </span>
          <span className={cn("text-sm font-bold leading-none mt-0.5", isToday ? "text-primary" : "text-foreground")}>
            {format(date, "d")}
          </span>
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0 text-left">
          <p className={cn("text-sm font-medium", isToday && "text-primary")}>
            {isToday ? "Today" : format(date, "EEEE, d MMMM")}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {onCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-success/15 text-success px-1.5 py-0.5 rounded-full font-medium">
                <Check className="h-2.5 w-2.5" /> {onCount} ON
              </span>
            )}
            {offCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-warning/15 text-warning px-1.5 py-0.5 rounded-full font-medium">
                <X className="h-2.5 w-2.5" /> {offCount} OFF
              </span>
            )}
            {lockedCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                <Lock className="h-2.5 w-2.5" /> {lockedCount}
              </span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </motion.div>
      </button>

      {/* Expanded meal cards */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {entries.map((entry) => (
                <MealCard
                  key={entry.id}
                  entry={entry}
                  onToggle={(newStatus) => onToggleMeal(entry.id, newStatus)}
                  loading={loading}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
});

// ─────────────────────────────────────────────────────────────
// Meal card — compact, with toggle switch
// ─────────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-3 p-2.5 rounded-2xl glass-soft">
      {/* Meal icon */}
      <div
        className="grid place-items-center h-10 w-10 rounded-xl shrink-0 text-xl"
        style={{
          background: `color-mix(in oklch, ${entry.meal.color} 15%, transparent)`,
        }}
      >
        {entry.meal.icon}
      </div>

      {/* Meal info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.meal.displayName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {to12h(entry.meal.startTime)} – {to12h(entry.meal.endTime)}
          </span>
          {isLocked && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive">
              <Lock className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => !isLocked && onToggle(isOn ? "OFF" : "ON")}
        disabled={isLocked || loading}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-all shrink-0",
          isOn ? "bg-success shadow-sm shadow-success/30" : "bg-muted",
          (isLocked || loading) && "opacity-50 cursor-not-allowed"
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm",
            isOn ? "ml-auto mr-1" : "ml-1"
          )}
        />
      </button>
    </div>
  );
});
