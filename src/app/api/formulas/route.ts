import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    await requireAuth();
    const formulas = await db.formula.findMany({
      where: { status: "ACTIVE" },
      orderBy: { category: "asc" },
    });
    return ok(formulas);
  } catch (e) {
    return handleApiError(e);
  }
}
