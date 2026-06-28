import { db } from "@/lib/db";
import { requireAuth, getClientIp, getUserAgent } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { currentPassword, newPassword } = schema.parse(body);

    const fullUser = await db.user.findUnique({ where: { id: user.id } });
    if (!fullUser) return err("User not found", 404);

    if (!verifyPassword(currentPassword, fullUser.passwordHash)) {
      return err("Current password is incorrect", 403);
    }

    if (currentPassword === newPassword) {
      return err("New password must be different from the current password", 422);
    }

    const newHash = hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all other sessions (keep the current one)
    const h = await import("next/headers").then((m) => m.headers());
    const currentToken = (h.get("authorization") || "").replace("Bearer ", "").trim();
    await db.userSession.updateMany({
      where: {
        userId: user.id,
        NOT: { token: currentToken },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await logAudit({
      actorId: user.id,
      action: "PASSWORD_CHANGE",
      entity: "User",
      entityId: user.id,
      ipAddress: await getClientIp(),
      userAgent: await getUserAgent(),
    });

    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
