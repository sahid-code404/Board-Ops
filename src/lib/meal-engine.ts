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
