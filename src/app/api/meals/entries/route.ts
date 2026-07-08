import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { computeEditableUntil, isLocked, isPreRegistration, getRegistrationDate } from "@/lib/meal-engine";
import { toLocalDateKey } from "@/lib/utils";
import type { MealConfiguration } from "@prisma/client";

/**
 * GET /api/meals/entries?year=&month=&date=
 * Returns meal entries for the current user for the given month (or specific date).
 * Auto-generates missing entries based on active meal configs (Service Date Engine).
 *
 * Pre-registration handling:
 *  - Does NOT auto-create entries for dates before the user's registration date.
 *  - Self-heals OLD auto-created pre-reg entries (updatedBy=null) to OFF + locked.
 *  - Admin-created pre-reg entries (updatedBy set) are preserved.
 *  - Pre-reg entries with no active override (overridden=false) are hidden from the response.
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

    // Parse "YYYY-MM-DD" as local time (not UTC) to avoid timezone shifts.
    // `new Date("2026-07-04")` parses as UTC midnight; in IST that's July 3 18:30.
    const start = specificDate
      ? (() => {
          const [y, m, d] = specificDate.split("-").map(Number);
          return new Date(y, (m || 1) - 1, d || 1);
        })()
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

    const registrationDate = getRegistrationDate(user.createdAt);

    // ── Self-healing: normalize OLD auto-created pre-reg entries ──
    // These have updatedBy=null (created by the buggy auto-create loop before
    // the fix). Set BOTH status AND originalState to "OFF" so the dynamic
    // override calculation (overridden = status !== originalState) returns
    // false — no override badge. Admin-created entries (updatedBy set) are
    // preserved.
    for (const entry of entries) {
      if (isPreRegistration(entry.serviceDate, user.createdAt) && !entry.updatedBy) {
        if (entry.status === "ON" || entry.status === "LOCKED" || !entry.locked || entry.originalState !== "OFF") {
          const updated = await db.mealEntry.update({
            where: { id: entry.id },
            data: { status: "OFF", originalState: "OFF", locked: true },
          });
          map.set(`${entry.mealId}_${entry.serviceDate.toDateString()}`, updated);
        }
      }
    }

    // ── Sync lock status + ensure entries exist (only for dates ON/AFTER registration) ──
    for (const meal of meals) {
      const days = specificDate ? 1 : end.getDate();
      for (let day = 1; day <= days; day++) {
        const d = specificDate ? new Date(start) : new Date(year, month, day);
        d.setHours(0, 0, 0, 0);

        // Skip auto-creating entries for dates before the user registered.
        // Admin overrides can still create these explicitly via /api/meals/override.
        if (isPreRegistration(d, user.createdAt)) continue;

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

    // ── Shape the response grouped by date ──
    // Override is calculated DYNAMICALLY: overridden = (effectiveStatus !== originalState)
    // where effectiveStatus treats LOCKED as ON. No overrideFlag stored in DB.
    // Pre-reg entries with no active override (overridden=false) are hidden.
    const byDate: Record<string, Array<{
      id: string;
      mealId: string;
      mealName: string;
      mealDisplayName: string;
      mealIcon: string;
      mealColor: string;
      serviceDate: string;
      status: string;
      originalState: string;
      overridden: boolean;
      editableUntil: string;
      locked: boolean;
      preRegistration: boolean;
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
        // Dynamic override calculation: Current State vs Original State
        const effectiveStatus = entry.status === "LOCKED" ? "ON" : entry.status;
        const overridden = effectiveStatus !== entry.originalState;
        // Pre-registration entries are only shown to the user if they have an
        // active admin override (overridden=true). If the admin set the meal
        // back to its default state (overridden=false), the entry is hidden —
        // the user wasn't enrolled, so there's nothing meaningful to show.
        const isPreReg = isPreRegistration(d, user.createdAt);
        if (isPreReg && !overridden) continue;
        const dateKey = toLocalDateKey(d);
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
          originalState: entry.originalState,
          overridden,
          editableUntil: entry.editableUntil.toISOString(),
          locked: entry.locked,
          preRegistration: isPreReg,
          startTime: meal.startTime,
          endTime: meal.endTime,
          mealType: meal.mealType,
        });
      }
    }

    return ok({ meals, byDate, registrationDate: registrationDate.toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}
