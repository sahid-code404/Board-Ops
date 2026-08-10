// Simple in-memory rate limiter.
// Tracks requests per IP + action. Resets after the window.
// For production, replace with Redis-based rate limiting.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5; // 5 attempts per minute per IP per action

type Record = { count: number; resetAt: number };
const store = new Map<string, Record>();

export function checkRateLimit(ip: string, action: string): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetAt: now + WINDOW_MS };
  }

  if (existing.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - existing.count, resetAt: existing.resetAt };
}

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}
