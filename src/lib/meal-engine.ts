import type { MealConfiguration } from "@prisma/client";

/**
 * Compute editable-until timestamp for a meal entry based on its configuration.
 * The frontend NEVER computes this — it always reads from backend.
 */
export function computeEditableUntil(
  meal: Pick<
    MealConfiguration,
    "cutoffStrategy" | "cutoffTime" | "cutoffOffsetMinutes"
  >,
  serviceDate: Date
): Date {
  const [hh, mm] = (meal.cutoffTime || "16:00").split(":").map(Number);
  const d = new Date(serviceDate);
  d.setHours(hh || 0, mm || 0, 0, 0);

  switch (meal.cutoffStrategy) {
    case "PREVIOUS_DAY":
      d.setDate(d.getDate() - 1);
      return d;
    case "CUSTOM_OFFSET":
      return new Date(d.getTime() - (meal.cutoffOffsetMinutes || 0) * 60 * 1000);
    case "SAME_DAY":
    default:
      return d;
  }
}

export function isLocked(editableUntil: Date, now = new Date()): boolean {
  return now.getTime() > editableUntil.getTime();
}

/**
 * Returns the registration date of a user, normalized to the START of that day
 * (00:00:00.000). Meal entries whose `serviceDate` falls BEFORE this date are
 * considered "pre-registration" — the user was not yet a resident.
 *
 * Uses date-only comparison (ignores time-of-day) so a user who registers at
 * 3 PM on June 15 is still eligible for meals on June 15 itself.
 */
export function getRegistrationDate(userCreatedAt: Date): Date {
  const d = new Date(userCreatedAt);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns TRUE if `serviceDate` is BEFORE the user's registration date.
 * Pre-registration meals:
 *   - are NOT auto-created (so they don't count in totals)
 *   - are NOT editable by the user (locked)
 *   - CAN be overridden by an admin (admin override creates them explicitly)
 *
 * Date-only comparison — time-of-day is ignored on both sides.
 */
export function isPreRegistration(serviceDate: Date, userCreatedAt: Date): boolean {
  const reg = getRegistrationDate(userCreatedAt);
  const svc = new Date(serviceDate);
  svc.setHours(0, 0, 0, 0);
  return svc.getTime() < reg.getTime();
}

export function formatDate(d: Date): string {
  return d.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatServiceDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
