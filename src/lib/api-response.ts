import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status }
  );
}

export function handleApiError(e: unknown) {
  if (e instanceof ZodError) {
    return err("Validation failed", 422, e.issues);
  }
  if (e instanceof Error) {
    if (e.message === "UNAUTHORIZED") return err("Authentication required", 401);
    if (e.message === "FORBIDDEN") return err("You don't have permission for this action", 403);
    if (e.message === "ACCOUNT_NOT_ACTIVE") return err("Account is not active", 403);
    return err(e.message, 400);
  }
  return err("Internal server error", 500);
}
