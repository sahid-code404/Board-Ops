import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const { id } = await ctx.params;
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, room: true } },
        payments: true,
      },
    });
    if (!bill) return err("Bill not found", 404);
    return ok(bill);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("SUPER_ADMIN", "ADMIN");
    const { id } = await ctx.params;
    const existing = await db.bill.findUnique({ where: { id } });
    if (!existing) return err("Bill not found", 404);

    await db.bill.update({ where: { id }, data: { status: "VOID" } });
    await logAudit({
      actorId: user.id,
      action: "VOID",
      entity: "Bill",
      entityId: id,
      oldValue: existing,
    });
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
