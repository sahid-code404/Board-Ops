"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { AnimatedCounter } from "@/components/glass/animated-counter";
import { StaggerGroup, StaggerItem } from "@/components/glass/page-transition";
import { ShimmerSkeleton } from "@/components/glass/shimmer-skeleton";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";
import { Users, Utensils, Wallet, Receipt, TrendingUp, TrendingDown, Bell, ArrowUpRight, Activity, Clock } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

type DashboardData = {
  todayMeals: Array<{
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
    startTime: string;
    endTime: string;
    status: string;
    locked: boolean;
    editableUntil: string;
  }>;
  kpis: {
    totalUsers: number;
    pendingUsers: number;
    todayOnCount: number;
    todayOffCount: number;
    totalRevenue: number;
    totalExpenses: number;
    pendingBills: number;
    netBalance: number;
  };
  trend: Array<{ date: string; on: number; off: number }>;
  expenseBreakdown: Array<{ category: string; amount: number }>;
  unreadNotifications: number;
  recentActivity: Array<any>;
  isAdmin: boolean;
};

const PIE_COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];

export function DashboardView() {
  const user = useAuthStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: DashboardData }>("/dashboard");
      return r.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <ShimmerSkeleton className="h-72 lg:col-span-2" />
          <ShimmerSkeleton className="h-72" />
        </div>
      </div>
    );
  }

  const kpis = data.isAdmin
    ? [
        { label: "Active Users", value: data.kpis.totalUsers, icon: Users, color: "primary", change: "+2 this week", route: "users" as const },
        { label: "Meals ON Today", value: data.kpis.todayOnCount, icon: Utensils, color: "success", change: `${data.kpis.todayOffCount} OFF`, route: "kitchen" as const },
        { label: "Revenue (Month)", value: data.kpis.totalRevenue, icon: Wallet, color: "info", change: "₹", prefix: "₹", route: "payments" as const },
        { label: "Net Balance", value: data.kpis.netBalance, icon: TrendingUp, color: "warning", change: "vs expenses", prefix: "₹", route: "expenses" as const },
      ]
    : [
        { label: "Meals ON Today", value: data.todayMeals.filter((m) => m.status === "ON").length, icon: Utensils, color: "success", change: `${data.todayMeals.filter((m) => m.status === "OFF").length} OFF`, route: "billing" as const },
        { label: "Pending Bills", value: data.kpis.pendingBills, icon: Receipt, color: "warning", change: "view billing", route: "billing" as const },
        { label: "Notifications", value: data.unreadNotifications, icon: Bell, color: "primary", change: "unread", route: "notifications" as const },
        { label: "Meals This Week", value: data.trend.reduce((s, t) => s + t.on, 0), icon: Activity, color: "info", change: "7-day total", route: "billing" as const },
      ];

  return (
    <StaggerGroup className="space-y-4 md:space-y-5">
      {/* Welcome — compact, no duplicate CTA */}
      <StaggerItem>
        <GlassCard className="p-4 md:p-6" hover={false} glow="primary">
          <p className="text-xs text-muted-foreground mb-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="text-xl md:text-2xl font-bold">
            Welcome back, {user?.name.split(" ")[0]} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {data.isAdmin
              ? "Here's what's happening across your operations today."
              : "Manage your meals, billing, and stay updated."}
          </p>
        </GlassCard>
      </StaggerItem>

      {/* KPIs */}
      <StaggerItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <motion.button
                key={kpi.label}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView(kpi.route)}
                className="text-left w-full"
              >
                <GlassCard className="p-4 md:p-5 cursor-pointer" glow={kpi.color as never}>
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="grid place-items-center h-10 w-10 rounded-2xl"
                      style={{
                        background: `color-mix(in oklch, var(--${kpi.color === "primary" ? "primary" : kpi.color === "success" ? "success" : kpi.color === "warning" ? "warning" : "info"}) 15%, transparent)`,
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: `var(--${kpi.color === "primary" ? "primary" : kpi.color === "success" ? "success" : kpi.color === "warning" ? "warning" : "info"})` }} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight">
                    <AnimatedCounter
                      value={kpi.value}
                      prefix={kpi.prefix || ""}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{kpi.change}</p>
                </GlassCard>
              </motion.button>
            );
          })}
        </div>
      </StaggerItem>

      {/* Today's meals — tap any card to open meals (admin) */}
      <StaggerItem>
        <GlassCard className="p-4 md:p-6" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Today's Meals</h3>
            {data.isAdmin && (
              <GlassButton variant="ghost" size="sm" onClick={() => setView("meals")}>
                View all
                <ArrowUpRight className="h-3.5 w-3.5" />
              </GlassButton>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.todayMeals.map((meal, i) => {
              const isOn = meal.status === "ON" || meal.status === "LOCKED";
              const isLocked = meal.locked || meal.status === "LOCKED";
              return (
                <motion.button
                  key={meal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => data.isAdmin && setView("meals")}
                  className="glass-soft rounded-2xl p-3 relative overflow-hidden text-left w-full"
                  style={{
                    opacity: isOn ? 1 : 0.5,
                    background: isOn
                      ? `linear-gradient(135deg, ${meal.color}30, transparent)`
                      : undefined,
                  }}
                >
                  <span className="text-2xl block mb-1.5">{meal.icon}</span>
                  <p className="font-medium text-sm leading-tight">{meal.displayName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {meal.startTime} – {meal.endTime}
                  </p>
                  {isLocked && (
                    <span className="absolute top-2 right-2 text-[10px] opacity-60">🔒</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </GlassCard>
      </StaggerItem>

      {/* Charts */}
      <StaggerItem>
        <div className="grid lg:grid-cols-3 gap-4">
          <GlassCard className="p-4 md:p-6 lg:col-span-2" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Meal Trends <span className="text-xs font-normal text-muted-foreground ml-1">· 7 days</span></h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> ON
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" /> OFF
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="onGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { weekday: "short" })}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    color: "var(--foreground)",
                  }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric" })}
                />
                <Area
                  type="monotone"
                  dataKey="on"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#onGrad)"
                  animationDuration={1200}
                />
                <Area
                  type="monotone"
                  dataKey="off"
                  stroke="var(--muted-foreground)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="transparent"
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard className="p-4 md:p-6" hover={false}>
            <h3 className="font-semibold mb-4">Expenses <span className="text-xs font-normal text-muted-foreground ml-1">· this month</span></h3>
            {data.expenseBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.expenseBreakdown}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      animationDuration={1000}
                    >
                      {data.expenseBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                      formatter={(v: number) => `₹${v.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {data.expenseBreakdown.slice(0, 4).map((e, i) => (
                    <div key={e.category} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{e.category}</span>
                      </span>
                      <span className="font-medium">₹{e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 grid place-items-center text-sm text-muted-foreground">
                No expenses this month
              </div>
            )}
          </GlassCard>
        </div>
      </StaggerItem>

      {/* Recent Activity (admin only) */}
      {data.isAdmin && data.recentActivity.length > 0 && (
        <StaggerItem>
          <GlassCard className="p-4 md:p-6" hover={false}>
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-2">
              {data.recentActivity.map((a) => (
                <div key={a.id} className="glass-soft rounded-2xl p-3 flex items-start gap-3">
                  <div className="grid place-items-center h-8 w-8 rounded-xl bg-primary/15 shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.actor?.name || "System"}</span>{" "}
                      <span className="text-muted-foreground">{a.action.toLowerCase().replace(/_/g, " ")}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </StaggerItem>
      )}
    </StaggerGroup>
  );
}
