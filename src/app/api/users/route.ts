import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q");

    const where = {
      ...(status ? { status } : {}),
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
      },
    });
    return ok(users);
  } catch (e) {
    return handleApiError(e);
  }
}
