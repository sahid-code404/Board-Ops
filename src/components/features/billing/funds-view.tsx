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
  Search,
  Check,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassInput } from "@/components/glass/glass-input";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import {
  StaggerGroup,
  StaggerItem,
} from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";

type UserFund = {
  userId: string;
  name: string;
  email: string;
  room: string | null;
  avatarUrl: string | null;
  billTotal: number;
  deposit: number;
  needToPay: number;
  hasBills: boolean;
};

type FundsData = {
  totalDeposit: number;
  totalExpenses: number;
  remainingFund: number;
  totalRefunded: number;
  month: number;
  year: number;
  users: UserFund[];
};

type ApiResponse<T> = { success: boolean; data: T };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
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

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function FundsView() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
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

  const users = data?.users ?? [];
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.room || "").toLowerCase().includes(q)
    );
  }, [users, search]);

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

      {/* KPIs — 3 in a single horizontal row */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-4" glow="success" hover={false}>
            <div className="grid place-items-center h-10 w-10 rounded-2xl bg-success/15 text-success mb-3">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">Total Deposit</p>
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              <AnimatedCounter value={data?.totalDeposit ?? 0} prefix="₹" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{MONTHS[selectedMonth]} {selectedYear}</p>
          </GlassCard>

          <GlassCard className="p-4" glow="primary" hover={false}>
            <div className="grid place-items-center h-10 w-10 rounded-2xl bg-primary/15 text-primary mb-3">
              <PiggyBank className="h-5 w-5" />
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

          <GlassCard className="p-4" hover={false}>
            <div className="grid place-items-center h-10 w-10 rounded-2xl bg-muted/40 text-muted-foreground mb-3">
              <TrendingDown className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">—</p>
            <div className="text-2xl font-bold tracking-tight text-muted-foreground">—</div>
            <p className="text-[11px] text-muted-foreground mt-1">Coming soon</p>
          </GlassCard>
        </div>
      </StaggerItem>

      {/* Search bar */}
      <StaggerItem>
        <GlassInput
          placeholder="Search by name, email, or room…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </StaggerItem>

      {/* User fund list */}
      <StaggerItem>
        {filteredUsers.length === 0 ? (
          <GlassCard className="p-10 text-center" hover={false}>
            <p className="text-sm text-muted-foreground">
              {search ? "No users match your search." : "No user data for this month."}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const isPaid = u.needToPay === 0 && u.hasBills;
              const hasDue = u.needToPay > 0;
              const noBills = !u.hasBills;

              return (
                <GlassCard key={u.userId} className="p-4" hover={false}>
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={cn(
                      "grid place-items-center h-10 w-10 rounded-xl shrink-0 text-xs font-bold bg-gradient-to-br text-white",
                      gradientFor(u.name)
                    )}>
                      {initials(u.name) || "U"}
                    </div>

                    {/* Name + room */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {u.room && (
                        <p className="text-[11px] text-muted-foreground">Room {u.room}</p>
                      )}
                    </div>

                    {/* Deposit */}
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Deposit</p>
                      <p className="text-sm font-semibold text-success tabular-nums">{formatINR(u.deposit)}</p>
                    </div>

                    {/* Need to pay */}
                    <div className="text-right shrink-0 min-w-[80px]">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Need to Pay</p>
                      {noBills ? (
                        <p className="text-sm font-medium text-muted-foreground">—</p>
                      ) : isPaid ? (
                        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-success">
                          <Check className="h-3.5 w-3.5" /> Paid
                        </span>
                      ) : (
                        <p className="text-sm font-bold text-warning tabular-nums">{formatINR(u.needToPay)}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      {noBills ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          No Bills
                        </span>
                      ) : isPaid ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">
                          <Check className="h-2.5 w-2.5" /> Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                          <AlertCircle className="h-2.5 w-2.5" /> Due
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </StaggerItem>
    </StaggerGroup>
  );
}
