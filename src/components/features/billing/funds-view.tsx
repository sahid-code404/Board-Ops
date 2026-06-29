"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  PiggyBank,
  TrendingDown,
  Wallet,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/use-auth-store";
import { GlassCard } from "@/components/glass/glass-card";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import {
  StaggerGroup,
  StaggerItem,
} from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";

type FundsData = {
  totalDeposit: number;
  totalExpenses: number;
  remainingFund: number;
  totalRefunded: number;
  month: number;
  year: number;
};

type ApiResponse<T> = { success: boolean; data: T };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function FundsView() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const isThisMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["funds", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const r = await api.get<ApiResponse<FundsData>>("/funds", {
        params: { month: selectedMonth, year: selectedYear },
      });
      return r.data;
    },
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ShimmerSkeleton className="h-14 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <ShimmerSkeleton className="h-28" />
          <ShimmerSkeleton className="h-28" />
          <ShimmerSkeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <StaggerGroup className="space-y-4 pb-6">
      {/* Month picker */}
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

      {/* KPIs — 3 in a single horizontal row (same as billing/meals) */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-3">
          {/* Total Deposit This Month */}
          <GlassCard className="p-4" glow="success" hover={false}>
            <div className="flex items-start justify-between mb-3">
              <div className="grid place-items-center h-10 w-10 rounded-2xl bg-success/15 text-success">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Total Deposit</p>
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              <AnimatedCounter value={data?.totalDeposit ?? 0} prefix="₹" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{MONTHS[selectedMonth]} {selectedYear}</p>
          </GlassCard>

          {/* Remaining Fund */}
          <GlassCard className="p-4" glow="primary" hover={false}>
            <div className="flex items-start justify-between mb-3">
              <div className="grid place-items-center h-10 w-10 rounded-2xl bg-primary/15 text-primary">
                <PiggyBank className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Remaining Fund</p>
            <div className={cn(
              "text-2xl font-bold tracking-tight tabular-nums",
              (data?.remainingFund ?? 0) < 0 && "text-destructive"
            )}>
              <AnimatedCounter value={data?.remainingFund ?? 0} prefix="₹" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Deposit − Expenses</p>
          </GlassCard>

          {/* Blank KPI — placeholder for future use */}
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between mb-3">
              <div className="grid place-items-center h-10 w-10 rounded-2xl bg-muted/40 text-muted-foreground">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">—</p>
            <div className="text-2xl font-bold tracking-tight text-muted-foreground">
              —
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Coming soon</p>
          </GlassCard>
        </div>
      </StaggerItem>

      {/* Summary breakdown */}
      <StaggerItem>
        <GlassCard className="p-4 md:p-6" hover={false}>
          <h3 className="font-semibold mb-4">
            Fund Summary <span className="text-xs font-normal text-muted-foreground ml-1">· {MONTHS[selectedMonth]} {selectedYear}</span>
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between glass-soft rounded-2xl px-4 py-3">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-success" />
                Total Deposits
              </span>
              <span className="text-sm font-semibold text-success tabular-nums">
                {formatINR(data?.totalDeposit ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between glass-soft rounded-2xl px-4 py-3">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Total Expenses
              </span>
              <span className="text-sm font-semibold text-destructive tabular-nums">
                {formatINR(data?.totalExpenses ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between glass-soft rounded-2xl px-4 py-3">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-info" />
                Total Refunded
              </span>
              <span className="text-sm font-semibold text-info tabular-nums">
                {formatINR(data?.totalRefunded ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between glass-strong rounded-2xl px-4 py-3 border-t border-border/40 mt-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-primary" />
                Remaining Fund
              </span>
              <span className={cn(
                "text-base font-bold tabular-nums",
                (data?.remainingFund ?? 0) < 0 ? "text-destructive" : "text-primary"
              )}>
                {formatINR(data?.remainingFund ?? 0)}
              </span>
            </div>
          </div>
        </GlassCard>
      </StaggerItem>
    </StaggerGroup>
  );
}
