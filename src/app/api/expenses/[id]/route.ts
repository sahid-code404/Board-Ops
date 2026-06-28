import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const editSchema = z.object({
  title: z.string().min(2, "Item name is required").optional(),
  category: z.string().min(2).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  description: z.string().nullable().optional(),
  expenseDate: z.string().transform((s) => new Date(s)).optional(),
  paidTo: z.string().nullable().optional(),
});

/** PUT /api/expenses/[id] — edit an expense (only if not locked) */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json();
    const data = editSchema.parse(body);

    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return err("Expense not found", 404);

    // Check if locked — can't edit if status is LOCKED or if the month has passed
    if (existing.status === "LOCKED") {
      return err("This expense is locked and cannot be edited", 422);
    }

    // Check if the expense's month is in the past (locked after month ends)
    const expDate = data.expenseDate || existing.expenseDate;
    const now = new Date();
    if (
      expDate.getFullYear() < now.getFullYear() ||
      (expDate.getFullYear() === now.getFullYear() && expDate.getMonth() < now.getMonth())
    ) {
      return err("Expenses from past months cannot be edited (locked)", 422);
    }

    const updated = await db.expense.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.expenseDate !== undefined && { expenseDate: data.expenseDate }),
        ...(data.paidTo !== undefined && { paidTo: data.paidTo }),
      },
    });

    await logAudit({
      actorId: user.id,
      action: "UPDATE",
      entity: "Expense",
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return err("Expense not found", 404);

    // Can't delete locked expenses
    if (existing.status === "LOCKED") {
      return err("This expense is locked and cannot be deleted", 422);
    }

    const now = new Date();
    if (
      existing.expenseDate.getFullYear() < now.getFullYear() ||
      (existing.expenseDate.getFullYear() === now.getFullYear() && existing.expenseDate.getMonth() < now.getMonth())
    ) {
      return err("Expenses from past months cannot be deleted (locked)", 422);
    }

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
