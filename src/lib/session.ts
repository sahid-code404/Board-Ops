import { db } from "@/lib/db";
import { headers } from "next/headers";
import { parseSessionToken } from "./auth";
import type { User } from "@prisma/client";

export type SessionUser = Pick<
  User,
  "id" | "name" | "email" | "phone" | "role" | "status" | "avatarUrl" | "room"
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
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    phone: session.user.phone ?? undefined,
    role: session.user.role,
    status: session.user.status,
    avatarUrl: session.user.avatarUrl ?? undefined,
    room: session.user.room ?? undefined,
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
