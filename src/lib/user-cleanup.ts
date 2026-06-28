import { db } from "@/lib/db";

/**
 * Permanently delete users whose soft-delete grace period (7 days) has expired.
 * Called on every GET /api/users to keep the deletion queue clean.
 */
export async function purgeExpiredUsers(): Promise<number> {
  try {
    const now = new Date();
    // Find users where deletedAt is set AND the 7-day grace period has passed
    const expired = await db.user.findMany({
      where: {
        deletedAt: { not: null, lt: now },
      },
      select: { id: true },
    });

    if (expired.length === 0) return 0;

    // Hard delete — cascades to sessions, meal entries, etc.
    const result = await db.user.deleteMany({
      where: {
        id: { in: expired.map((u) => u.id) },
      },
    });

    return result.count;
  } catch (e) {
    console.error("Failed to purge expired users:", e);
    return 0;
  }
}

/** Calculate the deletion date (7 days from now). */
export function getDeletionDate(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/** Format a countdown string (e.g., "5 days left", "12 hours left"). */
export function formatDeletionCountdown(deletedAt: Date): string {
  const now = new Date();
  const diff = deletedAt.getTime() - now.getTime();

  if (diff <= 0) return "Expiring soon";

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} left`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} left`;
  return "Less than 1 hour left";
}
