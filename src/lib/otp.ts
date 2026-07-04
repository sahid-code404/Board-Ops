import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Email OTP helpers.
 *
 * Generates 6-digit numeric OTPs, hashes them for secure storage, and verifies
 * with constant-time comparison. OTPs expire after 5 minutes. Max 5 failed
 * verification attempts before the OTP is invalidated.
 */

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;

/** Generate a cryptographically-random 6-digit OTP code. */
export function generateOtp(): string {
  const buf = randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

/** Hash an OTP code for secure storage (scrypt with random salt). */
export function hashOtp(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(code, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

/** Verify an OTP code against a stored hash (constant-time). */
export function verifyOtp(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const testHash = scryptSync(code, salt, 32);
  const storedHash = Buffer.from(hash, "hex");
  try {
    return testHash.length === storedHash.length && timingSafeEqual(testHash, storedHash);
  } catch {
    return false;
  }
}

/** Generate a short-lived pending token for the OTP verification step. */
export function generatePendingToken(): string {
  return `otp_${randomBytes(32).toString("hex")}`;
}

export const OTP_CONFIG = {
  ttlMs: OTP_TTL_MS,
  maxAttempts: MAX_OTP_ATTEMPTS,
};
