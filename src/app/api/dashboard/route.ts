import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { computeEditableUntil, isLocked } from "@/lib/meal-engine";

export async function GET() {
  try {
    const user = await requireAuth();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

    // ── Today's meals for current user ──
    const meals = await db.mealConfiguration.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
    });
    const todaysEntries = await db.mealEntry.findMany({
      where: { userId: user.id, serviceDate: today },
    });
    const todayMeals = meals.map((m) => {
      const entry = todaysEntries.find((e) => e.mealId === m.id);
      return {
        id: m.id,
        name: m.name,
        displayName: m.displayName,
        icon: m.icon,
        color: m.color,
        startTime: m.startTime,
        endTime: m.endTime,
        status: entry?.status ?? m.defaultState,
        locked: entry ? isLocked(entry.editableUntil) : isLocked(computeEditableUntil(m, today)),
        editableUntil: entry?.editableUntil.toISOString() ?? computeEditableUntil(m, today).toISOString(),
      };
    });

    // ── KPI counts ──
    const totalUsers = await db.user.count({ where: { status: "ACTIVE", role: "USER" } });
    const pendingUsers = await db.user.count({ where: { status: "PENDING" } });
    const todayOnCount = await db.mealEntry.count({
      where: { serviceDate: today, status: "ON" },
    });
    const todayOffCount = await db.mealEntry.count({
      where: { serviceDate: today, status: "OFF" },
    });

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const totalRevenue = await db.payment.aggregate({
      where: { status: "APPROVED", createdAt: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });
    const totalExpenses = await db.expense.aggregate({
      where: { status: "APPROVED", expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });
    const pendingBills = await db.bill.count({
      where: { status: { in: ["GENERATED", "PARTIALLY_PAID", "OVERDUE"] } },
    });

    // ── 7-day meal trend ──
    const trend: { date: string; on: number; off: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const on = await db.mealEntry.count({ where: { serviceDate: d, status: "ON" } });
      const off = await db.mealEntry.count({ where: { serviceDate: d, status: "OFF" } });
      trend.push({
        date: d.toISOString().slice(0, 10),
        on,
        off,
      });
    }

    // ── Expense breakdown by category ──
    const expensesRaw = await db.expense.findMany({
      where: { status: "APPROVED", expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { category: true, amount: true },
    });
    const byCategory: Record<string, number> = {};
    expensesRaw.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    // ── Recent notifications ──
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // ── Recent audit log (admin only) ──
    let recentActivity: Awaited<ReturnType<typeof db.auditLog.findMany>> = [];
    if (isAdmin) {
      recentActivity = await db.auditLog.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      });
    }

    return ok({
      todayMeals,
      kpis: {
        totalUsers,
        pendingUsers,
        todayOnCount,
        todayOffCount,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        totalExpenses: totalExpenses._sum.amount ?? 0,
        pendingBills,
        netBalance: (totalRevenue._sum.amount ?? 0) - (totalExpenses._sum.amount ?? 0),
      },
      trend,
      expenseBreakdown: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
      notifications,
      recentActivity,
      isAdmin,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
