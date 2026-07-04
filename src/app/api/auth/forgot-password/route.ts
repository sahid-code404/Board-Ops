import { db } from "@/lib/db";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/session";
import crypto from "crypto";
import { z } from "zod";

/**
 * POST /api/auth/forgot-password
 * PRD 03.12: Forgot Password flow — Email → OTP → Reset Password → Invalidate sessions
 *
 * Generates a 6-digit OTP, stores a SHA-256 hash + 10-min expiry on the user.
 * The OTP is logged to console (dev) + returned with ?dev=1.
 */
const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await db.user.findUnique({ where: { email } });

    // Always return success — don't leak whether the email exists
    if (!user) {
      return ok({ sent: true });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.user.update({
      where: { id: user.id },
      data: {
        resetOtpHash: otpHash,
        resetOtpExpires: expiresAt,
      },
    });

    // Log OTP to console (dev mode — in production this would be emailed)
    console.log(`[PASSWORD RESET OTP for ${email}]: ${otp}`);

    await logAudit({
      actorId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entity: "User",
      entityId: user.id,
      ipAddress: await getClientIp(),
      userAgent: await getUserAgent(),
    });

    // Return devOtp only with ?dev=1
    const url = new URL(req.url);
    const isDev = url.searchParams.get("dev") === "1";
    return ok({ sent: true, devOtp: isDev ? otp : undefined });
  } catch (e) {
    return handleApiError(e);
  }
}
