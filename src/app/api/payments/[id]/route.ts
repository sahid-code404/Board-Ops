import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import { getDeletionDate } from "@/lib/user-cleanup";
import { z } from "zod";

/** POST /api/payments/[id]/approve */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "APPROVE";

    const payment = await db.payment.findUnique({ where: { id }, include: { user: true } });
    if (!payment) return err("Payment not found", 404);
    if (payment.deletedAt) return err("Payment is scheduled for deletion", 422);

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

const editSchema = z.object({
  amount: z.number().positive().optional(),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "WALLET"]).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  action: z.enum(["EDIT", "VOID"]).optional(),
});

/** PUT /api/payments/[id] — admin edits a payment's fields, OR voids it.
 *  Body: { action: "EDIT", amount?, method?, reference?, notes? } for edit
 *        { action: "VOID" } to mark the payment as void (reverses any bill update if it was APPROVED) */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const data = editSchema.parse(body);

    const existing = await db.payment.findUnique({ where: { id }, include: { user: true } });
    if (!existing) return err("Payment not found", 404);
    if (existing.deletedAt) return err("Payment is scheduled for deletion", 422);

    // VOID action — mark as VOID and reverse any bill update if previously APPROVED
    if (data.action === "VOID") {
      if (existing.status === "VOID") return err("Payment is already void", 422);
      if (existing.status === "DELETED") return err("Payment is scheduled for deletion", 422);

      // Reverse the bill update if the payment was APPROVED and linked to a bill
      if (existing.status === "APPROVED" && existing.billId) {
        const bill = await db.bill.findUnique({ where: { id: existing.billId } });
        if (bill) {
          const paidAmount = Math.max(0, bill.paidAmount - existing.amount);
          const dueAmount = bill.totalAmount - paidAmount;
          await db.bill.update({
            where: { id: bill.id },
            data: {
              paidAmount,
              dueAmount,
              status: paidAmount === 0 ? "GENERATED" : "PARTIALLY_PAID",
            },
          });
        }
      }

      const updated = await db.payment.update({
        where: { id },
        data: { status: "VOID" },
      });

      await createNotification({
        userId: existing.userId,
        title: "Payment voided",
        description: `Your payment of ₹${existing.amount} via ${existing.method} has been voided by an administrator.`,
        type: "WARNING",
        priority: "HIGH",
        route: "billing",
      });

      await logAudit({
        actorId: user.id,
        action: "PAYMENT_VOID",
        entity: "Payment",
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });
      return ok(updated);
    }

    // EDIT action — update editable fields (amount, method, reference, notes)
    // Cannot edit if VOID or DELETED
    if (existing.status === "VOID") return err("Cannot edit a voided payment", 422);
    if (existing.status === "DELETED") return err("Payment is scheduled for deletion", 422);

    const updateData: Record<string, unknown> = {};
    if (data.amount !== undefined) {
      // If the payment is APPROVED and linked to a bill, changing the amount would
      // desync the bill's paidAmount. To keep this safe, refuse amount edits on
      // APPROVED payments linked to a bill — admin must void + resubmit instead.
      if (existing.status === "APPROVED" && existing.billId) {
        return err("Cannot edit amount on an approved payment linked to a bill. Void it and submit a new payment instead.", 422);
      }
      updateData.amount = data.amount;
    }
    if (data.method !== undefined) updateData.method = data.method;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (Object.keys(updateData).length === 0) {
      return err("No editable fields provided", 422);
    }

    const updated = await db.payment.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      actorId: user.id,
      action: "PAYMENT_EDIT",
      entity: "Payment",
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/payments/[id] — soft-delete a single payment (7-day grace period) */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reason = (body as { reason?: string }).reason;
    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) return err("Payment not found", 404);
    if (existing.deletedAt) return err("Payment is already scheduled for deletion", 422);

    const deletionDate = getDeletionDate();
    await db.payment.update({
      where: { id },
      data: { deletedAt: deletionDate, deletedBy: user.id, status: "DELETED", deletionReason: reason || null },
    });
    await logAudit({
      actorId: user.id,
      action: "PAYMENT_SOFT_DELETE",
      entity: "Payment",
      entityId: id,
      oldValue: existing,
      newValue: { deletedAt: deletionDate, status: "DELETED", reason },
      reason,
    });
    return ok({ success: true, permanentDeletion: deletionDate.toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}
