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
  notifications: Array<any>;
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
        { label: "Meals ON Today", value: data.todayMeals.filter((m) => m.status === "ON").length, icon: Utensils, color: "success", change: `${data.todayMeals.filter((m) => m.status === "OFF").length} OFF`, route: "calendar" as const },
        { label: "Pending Bills", value: data.kpis.pendingBills, icon: Receipt, color: "warning", change: "view billing", route: "billing" as const },
        { label: "Notifications", value: data.notifications.length, icon: Bell, color: "primary", change: "unread", route: "notifications" as const },
        { label: "Meals This Week", value: data.trend.reduce((s, t) => s + t.on, 0), icon: Activity, color: "info", change: "7-day total", route: "calendar" as const },
      ];

  return (
    <StaggerGroup className="space-y-4 md:space-y-6">
      {/* Welcome */}
      <StaggerItem>
        <GlassCard className="p-5 md:p-7" hover={false} glow="primary">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold">
                Welcome back, {user?.name.split(" ")[0]} 👋
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {data.isAdmin
                  ? "Here's what's happening across your operations today."
                  : "Manage your meals, billing, and stay updated."}
              </p>
            </div>
            {data.isAdmin && (
              <GlassButton onClick={() => setView("calendar")} size="lg">
                Open Calendar
              </GlassButton>
            )}
          </div>
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
                      className={`grid place-items-center h-10 w-10 rounded-2xl bg-${kpi.color}/15`}
                      style={{
                        background: `color-mix(in oklch, var(--${kpi.color === "primary" ? "primary" : kpi.color === "success" ? "success" : kpi.color === "warning" ? "warning" : "info"}) 15%, transparent)`,
                      }}
                    >
                      <Icon className="h-5 w-5 text-primary" />
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

      {/* Today's meals */}
      <StaggerItem>
        <GlassCard className="p-5 md:p-6" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Today's Meals</h3>
              <p className="text-xs text-muted-foreground">Your meal schedule for today</p>
            </div>
            <GlassButton variant="ghost" size="sm" onClick={() => setView("calendar")}>
              View calendar
            </GlassButton>
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
                  onClick={() => setView("calendar")}
                  className="glass-soft rounded-3xl p-4 relative overflow-hidden text-left w-full"
                  style={{
                    borderColor: isOn ? `${meal.color}60` : undefined,
                    background: isOn
                      ? `linear-gradient(135deg, ${meal.color}25, transparent)`
                      : undefined,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{meal.icon}</span>
                    {isLocked ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        🔒 Locked
                      </span>
                    ) : isOn ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">
                        ON
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        OFF
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm">{meal.displayName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {meal.startTime} – {meal.endTime}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </GlassCard>
      </StaggerItem>

      {/* Charts */}
      <StaggerItem>
        <div className="grid lg:grid-cols-3 gap-4">
          <GlassCard className="p-5 md:p-6 lg:col-span-2" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Meal Trends</h3>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </div>
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

          <GlassCard className="p-5 md:p-6" hover={false}>
            <h3 className="font-semibold text-lg mb-1">Expenses</h3>
            <p className="text-xs text-muted-foreground mb-4">By category this month</p>
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

      {/* Notifications + Activity */}
      <StaggerItem>
        <div className="grid lg:grid-cols-2 gap-4">
          <GlassCard className="p-5 md:p-6" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Recent Notifications</h3>
              <GlassButton variant="ghost" size="sm" onClick={() => setView("notifications")}>
                View all
              </GlassButton>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
              {data.notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
              ) : (
                data.notifications.map((n) => (
                  <motion.button
                    key={n.id}
                    whileHover={{ x: 4 }}
                    onClick={() => n.route && setView(n.route as never)}
                    className="glass-soft rounded-2xl p-3 flex items-start gap-3 w-full text-left"
                  >
                    <div
                      className={`grid place-items-center h-8 w-8 rounded-xl shrink-0 ${
                        n.type === "SUCCESS"
                          ? "bg-success/15"
                          : n.type === "WARNING"
                            ? "bg-warning/15"
                            : n.type === "DANGER"
                              ? "bg-destructive/15"
                              : "bg-info/15"
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                    </div>
                    {n.route && <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                  </motion.button>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-6" hover={false}>
            <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
            {data.isAdmin && data.recentActivity.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            )}
          </GlassCard>
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}
