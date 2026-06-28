import { db } from "@/lib/db";
import { headers } from "next/headers";
import { parseSessionToken } from "./auth";
import type { User } from "@prisma/client";

export type SessionUser = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "role"
  | "status"
  | "avatarUrl"
  | "room"
  | "gender"
  | "emergencyContact"
  | "theme"
  | "language"
  | "timezone"
  | "twoFactorEnabled"
  | "createdAt"
  | "lastLoginAt"
>;

export async function getAuthUser(): Promise<SessionUser | null> {
  const h = await headers();
  const auth = h.get("authorization") || h.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  const parsed = parseSessionToken(token);
  if (!parsed) return null;
  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? undefined,
    role: u.role,
    status: u.status,
    avatarUrl: u.avatarUrl ?? undefined,
    room: u.room ?? undefined,
    gender: u.gender ?? undefined,
    emergencyContact: u.emergencyContact ?? undefined,
    theme: u.theme,
    language: u.language,
    timezone: u.timezone,
    twoFactorEnabled: u.twoFactorEnabled,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getAuthUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.status !== "ACTIVE") throw new Error("ACCOUNT_NOT_ACTIVE");
  return user;
}

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0] ||
    h.get("x-real-ip") ||
    "127.0.0.1"
  );
}

export async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

/** Parse a User-Agent string into a human-friendly device/browser label. */
export function parseUserAgent(ua: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: "Unknown device", browser: "Unknown", os: "Unknown" };
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  if (/iPhone/.test(ua)) { os = "iOS"; device = "iPhone"; }
  else if (/iPad/.test(ua)) { os = "iPadOS"; device = "iPad"; }
  else if (/Android/.test(ua)) { os = "Android"; device = "Android"; }
  else if (/Mac OS X/.test(ua)) { os = "macOS"; device = "Mac"; }
  else if (/Windows/.test(ua)) { os = "Windows"; device = "PC"; }
  else if (/Linux/.test(ua)) { os = "Linux"; device = "Linux"; }

  if (/Edg/.test(ua)) browser = "Edge";
  else if (/Chrome/.test(ua) && /Safari/.test(ua)) browser = "Chrome";
  else if (/Firefox/.test(ua)) browser = "Firefox";
  else if (/Safari/.test(ua)) browser = "Safari";

  return { device, browser, os };
}
