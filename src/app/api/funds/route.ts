import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";

/** GET /api/funds — admin-only overview of funds for the selected month.
 *  Returns total deposit (approved payments), total expenses, and remaining fund. */
export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");

    const url = new URL(req.url);
    const month = Number(url.searchParams.get("month") ?? new Date().getMonth());
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Total deposit = sum of all APPROVED payments this month
    const approvedPayments = await db.payment.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { amount: true },
    });
    const totalDeposit = approvedPayments.reduce((s, p) => s + p.amount, 0);

    // Total expenses = sum of all expenses this month
    const expenses = await db.expense.findMany({
      where: {
        expenseDate: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { amount: true },
    });
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Remaining fund = deposits - expenses
    const remainingFund = totalDeposit - totalExpenses;

    // Refunded total (for reference)
    const refundedPayments = await db.payment.findMany({
      where: {
        status: "REFUNDED",
        createdAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { amount: true },
    });
    const totalRefunded = refundedPayments.reduce((s, p) => s + p.amount, 0);

    return ok({
      totalDeposit,
      totalExpenses,
      remainingFund,
      totalRefunded,
      month,
      year,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
