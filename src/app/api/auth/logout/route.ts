import { db } from "@/lib/db";
import { getAuthUser, getClientIp, getUserAgent } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export async function POST() {
  try {
    const user = await getAuthUser();
    const h = await headers();
    const auth = h.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (user && token) {
      await db.userSession.updateMany({
        where: { token, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await logAudit({
        actorId: user.id,
        action: "LOGOUT",
        entity: "User",
        entityId: user.id,
        ipAddress: await getClientIp(),
        userAgent: await getUserAgent(),
      });
    }
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
