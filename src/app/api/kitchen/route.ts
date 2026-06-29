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

    const entries = await db.mealEntry.findMany({
      where: { serviceDate: target },
    });

    const guestMeals = await db.guestMeal.findMany({
      where: { serviceDate: target },
    });

    const counts = meals.map((m) => {
      const on = entries.filter((e) => e.mealId === m.id && (e.status === "ON" || e.status === "LOCKED")).length;
      const off = entries.filter((e) => e.mealId === m.id && e.status === "OFF").length;
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
      // For past dates (before today), all meals are locked — cutoff has passed.
      // For today, check the editableUntil. For future dates, nothing is locked.
      const isPastDate = target < new Date(new Date().setHours(0, 0, 0, 0));
      const mealsOn = meals.map((m) => {
        const entry = userEntries.find((e) => e.mealId === m.id);
        // Compute actual locked state:
        // - Past dates: always locked (cutoff has passed)
        // - Today: check DB flag, status, or editableUntil
        // - Future dates: not locked
        const effectivelyLocked = isPastDate
          ? true
          : entry
            ? (entry.locked || entry.status === "LOCKED" || isLocked(entry.editableUntil))
            : false;
        return {
          mealId: m.id,
          mealName: m.displayName,
          mealIcon: m.icon,
          mealColor: m.color,
          status: entry?.status ?? "—",
          locked: effectivelyLocked,
          overrideFlag: entry?.overrideFlag ?? false,
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
        meals: mealsOn,
      };
    });

    return ok({ date: target.toISOString(), counts, activeUsers, monthTotals, userMealStatus });
  } catch (e) {
    return handleApiError(e);
  }
}
