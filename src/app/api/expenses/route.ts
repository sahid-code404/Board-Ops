import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 200);
    const category = url.searchParams.get("category");
    const month = url.searchParams.get("month"); // 0-11
    const year = url.searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (user.role === "USER") where.status = "APPROVED";
    if (month !== null && month !== undefined && year) {
      const m = Number(month);
      const y = Number(year);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      where.expenseDate = { gte: start, lte: end };
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    });
    return ok(expenses);
  } catch (e) {
    return handleApiError(e);
  }
}

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(2, "Category must be at least 2 characters").default("GENERAL"),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  expenseDate: z.string().transform((s) => new Date(s)),
  paidTo: z.string().optional(),
  receiptUrl: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = await req.json();
    const data = createSchema.parse(body);
    const expense = await db.expense.create({
      data: { ...data, status: "APPROVED", createdBy: user.id },
    });
    await logAudit({
      actorId: user.id,
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      newValue: expense,
    });
    return ok(expense, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
