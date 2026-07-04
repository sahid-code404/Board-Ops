import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { isLocked } from "@/lib/meal-engine";

/** GET /api/kitchen — meal counts for a specific day + month-to-date totals */
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    if (user.role === "USER") return ok({ access: false });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const target = date ? new Date(date) : new Date();
    target.setHours(0, 0, 0, 0);

    const meals = await db.mealConfiguration.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
    });

    // Exclude admin users' meals — only resident meals count in kitchen
    const adminIds = await db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true },
    });
    const adminIdSet = new Set(adminIds.map((u) => u.id));

    const entries = await db.mealEntry.findMany({
      where: { serviceDate: target },
    });
    // Filter out admin entries
    const residentEntries = entries.filter((e) => !adminIdSet.has(e.userId));

    const guestMeals = await db.guestMeal.findMany({
      where: { serviceDate: target },
    });

    const counts = meals.map((m) => {
      const on = residentEntries.filter((e) => e.mealId === m.id && (e.status === "ON" || e.status === "LOCKED")).length;
      const off = residentEntries.filter((e) => e.mealId === m.id && e.status === "OFF").length;
      const guests = guestMeals
        .filter((g) => g.mealId === m.id)
        .reduce((sum, g) => sum + g.guestCount, 0);
      return {
        id: m.id,
        name: m.name,
        displayName: m.displayName,
        icon: m.icon,
        color: m.color,
        startTime: m.startTime,
        endTime: m.endTime,
        on,
        off,
        guests,
        total: on + guests,
      };
    });

    // Month-to-date totals — all meal entries + guest meals in the same month
    // as the selected date
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthEntries = await db.mealEntry.findMany({
      where: {
        serviceDate: { gte: monthStart, lte: monthEnd },
        status: { in: ["ON", "LOCKED"] },
      },
    });

    const monthGuestMeals = await db.guestMeal.findMany({
      where: { serviceDate: { gte: monthStart, lte: monthEnd } },
    });

    const monthTotals = {
      meals: monthEntries.length + monthGuestMeals.reduce((s, g) => s + g.guestCount, 0),
      guests: monthGuestMeals.reduce((s, g) => s + g.guestCount, 0),
      off: await db.mealEntry.count({
        where: {
          serviceDate: { gte: monthStart, lte: monthEnd },
          status: "OFF",
        },
      }),
    };

    // Count active residents (for percentage calculation — excludes guests)
    const activeUsers = await db.user.count({
      where: { status: "ACTIVE", role: "USER" },
    });

    // Per-user meal status for the selected date — admin can see who's ON/OFF
    const activeResidents = await db.user.findMany({
      where: { status: "ACTIVE", role: "USER" },
      select: { id: true, name: true, email: true, room: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    const userMealStatus = activeResidents.map((u) => {
      const userEntries = entries.filter((e) => e.userId === u.id);
      // Total meals consumed this month (ON + LOCKED entries) — used in the
      // expanded user card so admin sees a running monthly tally per resident.
      const monthConsumed = monthEntries.filter((e) => e.userId === u.id).length;
      const isPastDate = target < new Date(new Date().setHours(0, 0, 0, 0));
      const mealsOn = meals.map((m) => {
        const entry = userEntries.find((e) => e.mealId === m.id);
        const effectivelyLocked = isPastDate
          ? true
          : entry
            ? (entry.locked || entry.status === "LOCKED" || isLocked(entry.editableUntil))
            : false;
        // Override logic: compare current status with original state.
        // This detects admin overrides (admin changed the meal from its original system state).
        // User toggles also change status, but the override API preserves originalState,
        // so when a user toggles, originalState stays as the meal config default —
        // the comparison correctly shows override only when the CURRENT status differs
        // from what the system originally set.
        const originalState = entry?.originalState || m.defaultState;
        const currentStatus = entry?.status || m.defaultState;
        const isOverridden = currentStatus !== originalState && currentStatus !== "LOCKED";
        return {
          mealId: m.id,
          mealName: m.displayName,
          mealIcon: m.icon,
          mealColor: m.color,
          status: currentStatus,
          locked: effectivelyLocked,
          overrideFlag: isOverridden,
        };
      });
      const onCount = mealsOn.filter((m) => m.status === "ON" || m.status === "LOCKED").length;
      const offCount = mealsOn.filter((m) => m.status === "OFF").length;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        room: u.room,
        avatarUrl: u.avatarUrl,
        onCount,
        offCount,
        monthConsumed,
        meals: mealsOn,
      };
    });

    return ok({ date: target.toISOString(), counts, activeUsers, monthTotals, userMealStatus });
  } catch (e) {
    return handleApiError(e);
  }
}
