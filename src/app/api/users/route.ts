import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { purgeExpiredUsers } from "@/lib/user-cleanup";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");

    // Auto-purge users whose 7-day grace period has expired
    await purgeExpiredUsers();

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q");

    // "DELETED" is a client-side filter (checks deletedAt), not a DB status
    const dbStatus = status && status !== "DELETED" ? status : undefined;

    const where = {
      ...(dbStatus ? { status: dbStatus } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
              { room: { contains: search } },
            ],
          }
        : {}),
    };
    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        room: true,
        gender: true,
        emergencyContact: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true,
        deletionReason: true,
      },
    });
    return ok(users);
  } catch (e) {
    return handleApiError(e);
  }
}
