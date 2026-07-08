import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { computeEditableUntil, isLocked } from "@/lib/meal-engine";
import { toLocalDateKey } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireAuth();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const isAdmin = user.role === "ADMIN";

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
    // Total active users = residents + admins (both count as users of the system)
    const totalUsers = await db.user.count({ where: { status: "ACTIVE", deletedAt: null } });
    const pendingUsers = await db.user.count({ where: { status: "PENDING", deletedAt: null } });
    // Meal counts — exclude admin users (admins don't count as residents for meals)
    const todayOnCount = await db.mealEntry.count({
      where: { serviceDate: today, status: "ON", user: { role: "USER" } },
    });
    const todayOffCount = await db.mealEntry.count({
      where: { serviceDate: today, status: "OFF", user: { role: "USER" } },
    });

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const totalRevenue = await db.payment.aggregate({
      where: { status: "APPROVED", createdAt: { gte: startOfMonth, lte: endOfMonth }, user: { role: "USER" } },
      _sum: { amount: true },
    });
    const totalExpenses = await db.expense.aggregate({
      where: { status: "APPROVED", expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });
    const pendingBills = await db.bill.count({
      where: { status: { in: ["GENERATED", "PARTIALLY_PAID", "OVERDUE"] }, user: { role: "USER" } },
    });

    // PRD: Calculate current meal charge = (total expenses - guest revenue) / total resident meals
    // Exclude admin users' meals — only resident meals count
    const totalResidentMeals = await db.mealEntry.count({
      where: { serviceDate: { gte: startOfMonth, lte: endOfMonth }, status: { in: ["ON", "LOCKED"] }, user: { role: "USER" } },
    });
    const guestMeals = await db.guestMeal.findMany({
      where: { serviceDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { guestCount: true },
    });
    const totalGuestMeals = guestMeals.reduce((s, g) => s + (g.guestCount || 1), 0);
    const guestChargeVar = await db.variable.findUnique({ where: { key: "guest_meal_rate" } });
    const guestRate = guestChargeVar ? parseFloat(guestChargeVar.value) || 0 : 0;
    const guestRevenue = totalGuestMeals * guestRate;
    const totalExpensesAmount = totalExpenses._sum.amount ?? 0;
    const currentMealCharge = totalResidentMeals > 0
      ? Math.max(0, (totalExpensesAmount - guestRevenue) / totalResidentMeals)
      : 0;

    // ── 7-day meal trend ──
    const trend: { date: string; on: number; off: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const on = await db.mealEntry.count({ where: { serviceDate: d, status: "ON", user: { role: "USER" } } });
      const off = await db.mealEntry.count({ where: { serviceDate: d, status: "OFF", user: { role: "USER" } } });
      trend.push({
        date: toLocalDateKey(d),
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

    // ── Unread notification count (for badge) ──
    const unreadNotifications = await db.notification.count({
      where: { userId: user.id, readAt: null },
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
        totalExpenses: totalExpensesAmount,
        pendingBills,
        currentMealCharge,
        totalResidentMeals,
      },
      trend,
      expenseBreakdown: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
      unreadNotifications,
      recentActivity,
      isAdmin,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
