import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { isLocked, isPreRegistration, computeEditableUntil } from "@/lib/meal-engine";

// ── Counting helpers ──
// The admin kitchen only counts meals that are CONFIRMED:
//   - Locked (past cutoff — the user can no longer change it), OR
//   - Admin-overridden (the admin explicitly set the Current State)
// Unlocked meals that the user can still toggle are NOT counted.
// Admin-overridden OFF meals are NOT counted toward "off" either.

/** Dynamic override check: Current State !== Original State */
function isOverridden(e: { status: string; originalState: string }): boolean {
  const effective = e.status === "LOCKED" ? "ON" : e.status;
  return effective !== e.originalState;
}

/** Is this entry effectively locked (user can no longer change it)? */
function isEntryLocked(e: { locked: boolean; status: string; editableUntil: Date }, isPastDate: boolean): boolean {
  if (isPastDate) return true;
  return e.locked || e.status === "LOCKED" || isLocked(e.editableUntil);
}

/** Counts toward "on": status is ON/LOCKED AND (locked OR overridden) */
function countsAsOn(e: { status: string; originalState: string; locked: boolean; editableUntil: Date }, isPastDate: boolean): boolean {
  if (e.status !== "ON" && e.status !== "LOCKED") return false;
  return isEntryLocked(e, isPastDate) || isOverridden(e);
}

/** Counts toward "off": status is OFF AND locked AND NOT overridden */
function countsAsOff(e: { status: string; originalState: string; locked: boolean; editableUntil: Date }, isPastDate: boolean): boolean {
  if (e.status !== "OFF") return false;
  return isEntryLocked(e, isPastDate) && !isOverridden(e);
}

/** GET /api/kitchen — meal counts for a specific day + month-to-date totals */
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    if (user.role === "USER") return ok({ access: false });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    // Parse "YYYY-MM-DD" as local time (not UTC) to avoid timezone shifts.
    const target = date
      ? (() => {
          const [y, m, d] = date.split("-").map(Number);
          return new Date(y, (m || 1) - 1, d || 1);
        })()
      : new Date();
    target.setHours(0, 0, 0, 0);

    const isPastDate = target < new Date(new Date().setHours(0, 0, 0, 0));

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
    // Filter out admin entries.
    const residentEntries = entries.filter((e) => !adminIdSet.has(e.userId));

    const guestMeals = await db.guestMeal.findMany({
      where: { serviceDate: target },
    });

    // Daily counts — only count confirmed meals (locked or admin-overridden)
    const counts = meals.map((m) => {
      const mealEntries = residentEntries.filter((e) => e.mealId === m.id);
      const on = mealEntries.filter((e) => countsAsOn(e, isPastDate)).length;
      const off = mealEntries.filter((e) => countsAsOff(e, isPastDate)).length;
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

    // Month-to-date totals
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch ALL entries for the month (we need locked + originalState to compute
    // override status; can't filter in the query since override is dynamic)
    const monthEntriesRaw = await db.mealEntry.findMany({
      where: {
        serviceDate: { gte: monthStart, lte: monthEnd },
      },
    });

    // For month entries, each entry's "locked" status depends on its own
    // editableUntil vs. now (not the selected date). Use isLocked() directly.
    const monthOnEntries = monthEntriesRaw.filter((e) => {
      if (e.status !== "ON" && e.status !== "LOCKED") return false;
      const entryLocked = isLocked(e.editableUntil) || e.locked || e.status === "LOCKED";
      return entryLocked || isOverridden(e);
    });
    const monthOffEntries = monthEntriesRaw.filter((e) => {
      if (e.status !== "OFF") return false;
      const entryLocked = isLocked(e.editableUntil) || e.locked;
      return entryLocked && !isOverridden(e);
    });

    const monthGuestMeals = await db.guestMeal.findMany({
      where: { serviceDate: { gte: monthStart, lte: monthEnd } },
    });

    const monthTotals = {
      meals: monthOnEntries.length + monthGuestMeals.reduce((s, g) => s + g.guestCount, 0),
      guests: monthGuestMeals.reduce((s, g) => s + g.guestCount, 0),
      off: monthOffEntries.length,
    };

    // Count active residents (for percentage calculation — excludes guests)
    const activeUsers = await db.user.count({
      where: { status: "ACTIVE", role: "USER" },
    });

    // Per-user meal status for the selected date — admin can see who's ON/OFF
    const activeResidents = await db.user.findMany({
      where: { status: "ACTIVE", role: "USER" },
      select: { id: true, name: true, email: true, room: true, avatarUrl: true, createdAt: true },
      orderBy: { name: "asc" },
    });

    const userMealStatus = activeResidents.map((u) => {
      const userEntries = residentEntries.filter((e) => e.userId === u.id);
      // Monthly consumed = confirmed ON meals only (locked or admin-overridden)
      const monthConsumed = monthOnEntries.filter((e) => e.userId === u.id).length;
      const isPreRegDate = isPreRegistration(target, u.createdAt);
      const mealsOn = meals.map((m) => {
        const entry = userEntries.find((e) => e.mealId === m.id);
        // LB-5: unified locked logic — same as the counting helpers and the
        // dashboard. For an existing entry: locked when past editableUntil,
        // explicitly locked, or status LOCKED. For a missing entry: locked when
        // the meal's own computed cutoff (editableUntil) has passed.
        const effectivelyLocked = entry
          ? (isLocked(entry.editableUntil) || entry.locked || entry.status === "LOCKED")
          : isLocked(computeEditableUntil(m, target));
        // When no entry exists for a pre-registration date, default to "OFF".
        const currentStatus = entry?.status || (isPreRegDate ? "OFF" : m.defaultState);
        // Pre-reg meals ALWAYS default to OFF, regardless of meal config.
        const originalState = entry?.originalState || (isPreRegDate ? "OFF" : m.defaultState);
        // Dynamic override calculation: Current State vs Original State.
        const effectiveStatus = currentStatus === "LOCKED" ? "ON" : currentStatus;
        const overridden = entry ? effectiveStatus !== originalState : false;
        return {
          mealId: m.id,
          mealName: m.displayName,
          mealIcon: m.icon,
          mealColor: m.color,
          status: currentStatus,
          originalState,
          locked: effectivelyLocked,
          overridden,
        };
      });
      // Per-user counts — same rule: only count confirmed meals
      const onCount = mealsOn.filter((m) => {
        if (m.status !== "ON" && m.status !== "LOCKED") return false;
        return m.locked || m.overridden;
      }).length;
      const offCount = mealsOn.filter((m) => {
        if (m.status !== "OFF") return false;
        return m.locked && !m.overridden;
      }).length;
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
        notEnrolled: isPreRegDate,
      };
    });

    return ok({ date: target.toISOString(), counts, activeUsers, monthTotals, userMealStatus });
  } catch (e) {
    return handleApiError(e);
  }
}
