import { db } from "@/lib/db";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/session";
import { z } from "zod";
import { hashOtp } from "../register/route";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp } = schema.parse(body);
    const normalizedEmail = email.toLowerCase();

    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return err("Invalid or expired code", 400);

    // Idempotent: if already verified, return ok.
    if (user.emailVerified) {
      return ok({ userId: user.id, email: user.email, emailVerified: true });
    }

    if (!user.emailVerifyToken || !user.emailVerifyExpires) {
      return err("Invalid or expired code", 400);
    }
    if (user.emailVerifyExpires < new Date()) {
      return err("Invalid or expired code", 400);
    }
    const submittedHash = hashOtp(otp);
    if (submittedHash !== user.emailVerifyToken) {
      return err("Invalid or expired code", 400);
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    // The user is still PENDING admin approval — the RegistrationRequest
    // remains PENDING_REVIEW. We just clear the OTP state.
    await logAudit({
      actorId: user.id,
      action: "EMAIL_VERIFIED",
      entity: "User",
      entityId: user.id,
      ipAddress: await getClientIp(),
      userAgent: await getUserAgent(),
    });

    return ok({ userId: user.id, email: user.email, emailVerified: true });
  } catch (e) {
    return handleApiError(e);
  }
}
