import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import { z } from "zod";

/** GET /api/payments/refund — lists users with credit balance (overpaid bills).
 *  Returns users where any bill has paidAmount > totalAmount, with the total credit amount. */
export async function GET() {
  try {
    await requireRole("ADMIN");

    // Find all bills where paidAmount > totalAmount (credit exists)
    const creditBills = await db.bill.findMany({
      where: {
        paidAmount: { gt: db.bill.fields.totalAmount },
        deletedAt: null,
        status: { notIn: ["VOID", "DELETED"] },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, room: true } },
      },
    });

    // Group by user and sum credit
    const userMap = new Map<string, {
      userId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      room: string | null;
      creditAmount: number;
      bills: Array<{ id: string; periodMonth: number; periodYear: number; totalAmount: number; paidAmount: number; credit: number }>;
    }>();

    for (const bill of creditBills) {
      const credit = bill.paidAmount - bill.totalAmount;
      if (credit <= 0) continue;

      const existing = userMap.get(bill.userId);
      if (existing) {
        existing.creditAmount += credit;
        existing.bills.push({
          id: bill.id,
          periodMonth: bill.periodMonth,
          periodYear: bill.periodYear,
          totalAmount: bill.totalAmount,
          paidAmount: bill.paidAmount,
          credit,
        });
      } else {
        userMap.set(bill.userId, {
          userId: bill.userId,
          name: bill.user.name,
          email: bill.user.email,
          avatarUrl: bill.user.avatarUrl,
          room: bill.user.room,
          creditAmount: credit,
          bills: [{
            id: bill.id,
            periodMonth: bill.periodMonth,
            periodYear: bill.periodYear,
            totalAmount: bill.totalAmount,
            paidAmount: bill.paidAmount,
            credit,
          }],
        });
      }
    }

    return ok(Array.from(userMap.values()).sort((a, b) => b.creditAmount - a.creditAmount));
  } catch (e) {
    return handleApiError(e);
  }
}

const refundSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
  billId: z.string().optional(),
  notes: z.string().optional(),
});

/** POST /api/payments/refund — processes a refund to a user.
 *  Creates a REFUNDED payment record, reduces the bill's paidAmount, and notifies the user. */
export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const body = await req.json();
    const data = refundSchema.parse(body);

    // Verify the user has enough credit
    const where = data.billId
      ? { id: data.billId, userId: data.userId, deletedAt: null }
      : { userId: data.userId, deletedAt: null, status: { notIn: ["VOID", "DELETED"] } };

    const bills = await db.bill.findMany({
      where: where as Record<string, unknown>,
      orderBy: { createdAt: "desc" },
    });

    const totalCredit = bills.reduce((s, b) => s + Math.max(0, b.paidAmount - b.totalAmount), 0);
    if (totalCredit < data.amount) {
      return err(`User only has ₹${Math.round(totalCredit)} credit (requested ₹${Math.round(data.amount)})`, 422);
    }

    // Create a REFUNDED payment record
    const payment = await db.payment.create({
      data: {
        userId: data.userId,
        billId: data.billId || bills[0]?.id || null,
        amount: data.amount,
        method: "REFUND",
        status: "REFUNDED",
        reference: "REFUND",
        notes: data.notes || "Refund of excess deposit",
        approvedBy: admin.id,
      },
    });

    // Reduce the bill's paidAmount by the refund amount
    // If a specific billId was given, reduce that bill. Otherwise, reduce from the
    // most recent bills until the full refund amount is consumed.
    let remaining = data.amount;
    for (const bill of bills) {
      if (remaining <= 0) break;
      const credit = Math.max(0, bill.paidAmount - bill.totalAmount);
      if (credit <= 0) continue;
      const reduction = Math.min(credit, remaining);
      const newPaidAmount = bill.paidAmount - reduction;
      const newDueAmount = Math.max(0, bill.totalAmount - newPaidAmount);
      const newStatus = newDueAmount === 0 ? "PAID" : (newPaidAmount === 0 ? "GENERATED" : "PARTIALLY_PAID");
      await db.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          status: newStatus,
        },
      });
      remaining -= reduction;
    }

    // Notify the user
    const user = await db.user.findUnique({ where: { id: data.userId } });
    if (user) {
      await createNotification({
        userId: data.userId,
        title: "Refund processed",
        description: `₹${Math.round(data.amount)} has been refunded to your account${data.notes ? ` — ${data.notes}` : ""}.`,
        type: "INFO",
        priority: "HIGH",
        route: "billing",
      });
    }

    await logAudit({
      actorId: admin.id,
      action: "PAYMENT_REFUND",
      entity: "Payment",
      entityId: payment.id,
      newValue: { userId: data.userId, amount: data.amount, billId: data.billId },
    });

    return ok(payment, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
