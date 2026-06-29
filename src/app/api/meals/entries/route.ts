import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { computeEditableUntil, isLocked } from "@/lib/meal-engine";
import type { MealConfiguration } from "@prisma/client";

/**
 * GET /api/meals/entries?year=&month=&date=
 * Returns meal entries for the current user for the given month (or specific date).
 * Auto-generates missing entries based on active meal configs (Service Date Engine).
 */
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const month = Number(url.searchParams.get("month") || new Date().getMonth());
    const specificDate = url.searchParams.get("date");

    const meals = await db.mealConfiguration.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
    });

    const start = specificDate
      ? new Date(specificDate)
      : new Date(year, month, 1);
    const end = specificDate
      ? new Date(start)
      : new Date(year, month + 1, 0);

    if (specificDate) {
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const entries = await db.mealEntry.findMany({
      where: {
        userId: user.id,
        serviceDate: { gte: start, lte: end },
      },
    });

    const map = new Map<string, typeof entries[number]>();
    entries.forEach((e) => map.set(`${e.mealId}_${e.serviceDate.toDateString()}`, e));

    // Sync lock status + ensure entries exist
    for (const meal of meals) {
      const days = specificDate ? 1 : end.getDate();
      for (let day = 1; day <= days; day++) {
        const d = specificDate ? new Date(start) : new Date(year, month, day);
        d.setHours(0, 0, 0, 0);
        const key = `${meal.id}_${d.toDateString()}`;
        let entry = map.get(key);
        if (!entry) {
          const editableUntil = computeEditableUntil(meal, d);
          const locked = isLocked(editableUntil);
          try {
            entry = await db.mealEntry.create({
              data: {
                userId: user.id,
                mealId: meal.id,
                serviceDate: d,
                status: meal.defaultState,
                originalState: meal.defaultState,
                editableUntil,
                locked,
              },
            });
            map.set(key, entry);
          } catch {
            // race-safe: another concurrent create likely succeeded
            const found = await db.mealEntry.findFirst({
              where: { userId: user.id, mealId: meal.id, serviceDate: d },
            });
            if (found) {
              map.set(key, found);
              entry = found;
            }
          }
        } else {
          // refresh lock state in DB if needed
          const locked = isLocked(entry.editableUntil);
          if (entry.locked !== locked || (entry.status === "ON" && locked && entry.status !== "LOCKED")) {
            const updated = await db.mealEntry.update({
              where: { id: entry.id },
              data: {
                locked,
                status: locked && entry.status === "ON" ? "LOCKED" : entry.status === "LOCKED" && !locked ? "ON" : entry.status,
              },
            });
            map.set(key, updated);
          }
        }
      }
    }

    // Shape the response grouped by date
    const byDate: Record<string, Array<{
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
    }>> = {};

    for (const meal of meals) {
      const days = specificDate ? 1 : end.getDate();
      for (let day = 1; day <= days; day++) {
        const d = specificDate ? new Date(start) : new Date(year, month, day);
        d.setHours(0, 0, 0, 0);
        const key = `${meal.id}_${d.toDateString()}`;
        const entry = map.get(key);
        if (!entry) continue;
        const dateKey = d.toISOString().slice(0, 10);
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push({
          id: entry.id,
          mealId: meal.id,
          mealName: meal.name,
          mealDisplayName: meal.displayName,
          mealIcon: meal.icon,
          mealColor: meal.color,
          serviceDate: entry.serviceDate.toISOString(),
          status: entry.status,
          editableUntil: entry.editableUntil.toISOString(),
          locked: entry.locked,
          overrideFlag: entry.overrideFlag,
          startTime: meal.startTime,
          endTime: meal.endTime,
          mealType: meal.mealType,
        });
      }
    }

    return ok({ meals, byDate });
  } catch (e) {
    return handleApiError(e);
  }
}
