import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return err("Expense not found", 404);
    await db.expense.delete({ where: { id } });
    await logAudit({
      actorId: user.id,
      action: "DELETE",
      entity: "Expense",
      entityId: id,
      oldValue: existing,
    });
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
