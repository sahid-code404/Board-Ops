import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 50);
    const entity = url.searchParams.get("entity");

    const logs = await db.auditLog.findMany({
      where: entity ? { entity } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { name: true, email: true } } },
    });
    return ok(logs);
  } catch (e) {
    return handleApiError(e);
  }
}
