import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";

/** GET /api/kitchen — meal counts for today + tomorrow (kitchen dashboard) */
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

    // Count active residents (for percentage calculation — excludes guests)
    const activeUsers = await db.user.count({
      where: { status: "ACTIVE", role: "USER" },
    });

    return ok({ date: target.toISOString(), counts, activeUsers });
  } catch (e) {
    return handleApiError(e);
  }
}
