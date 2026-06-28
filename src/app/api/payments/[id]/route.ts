import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";

/** POST /api/payments/[id]/approve */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("SUPER_ADMIN", "ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "APPROVE";

    const payment = await db.payment.findUnique({ where: { id }, include: { user: true } });
    if (!payment) return err("Payment not found", 404);

    const newStatus = action === "REJECT" ? "REJECTED" : "APPROVED";
    const updated = await db.payment.update({
      where: { id },
      data: { status: newStatus, approvedBy: user.id },
    });

    if (newStatus === "APPROVED" && payment.billId) {
      const bill = await db.bill.findUnique({ where: { id: payment.billId } });
      if (bill) {
        const paidAmount = bill.paidAmount + payment.amount;
        const dueAmount = Math.max(0, bill.totalAmount - paidAmount);
        await db.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount,
            dueAmount,
            status: dueAmount === 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });
      }
    }

    await createNotification({
      userId: payment.userId,
      title: `Payment ${newStatus.toLowerCase()}`,
      description: `Your payment of ₹${payment.amount} via ${payment.method} has been ${newStatus.toLowerCase()}.`,
      type: newStatus === "APPROVED" ? "SUCCESS" : "WARNING",
      priority: "HIGH",
      route: "billing",
    });

    await logAudit({
      actorId: user.id,
      action: `PAYMENT_${newStatus}`,
      entity: "Payment",
      entityId: id,
      oldValue: payment,
      newValue: updated,
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
