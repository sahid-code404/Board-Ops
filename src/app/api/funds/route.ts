import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";

/** GET /api/funds — admin-only overview of funds for the selected month.
 *  Returns KPI totals + per-user breakdown (deposit paid, bill total, amount to pay). */
export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");

    const url = new URL(req.url);
    const month = Number(url.searchParams.get("month") ?? new Date().getMonth());
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // ── KPI totals ──

    const approvedPayments = await db.payment.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { amount: true },
    });
    const totalDeposit = approvedPayments.reduce((s, p) => s + p.amount, 0);

    const expenses = await db.expense.findMany({
      where: {
        expenseDate: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { amount: true },
    });
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    const remainingFund = totalDeposit - totalExpenses;

    const refundedPayments = await db.payment.findMany({
      where: {
        status: "REFUNDED",
        createdAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { amount: true },
    });
    const totalRefunded = refundedPayments.reduce((s, p) => s + p.amount, 0);

    // ── Per-user breakdown ──
    // Get all active residents
    const residents = await db.user.findMany({
      where: { status: "ACTIVE", role: "USER" },
      select: { id: true, name: true, email: true, room: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    // Get bills for this month (including soft-deleted — financial data still counts)
    const bills = await db.bill.findMany({
      where: {
        periodMonth: month,
        periodYear: year,
        status: { notIn: ["VOID"] },
      },
      select: { id: true, userId: true, totalAmount: true, paidAmount: true, dueAmount: true },
    });

    // Get approved payments for this month grouped by user
    const userPayments = await db.payment.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { userId: true, amount: true },
    });

    // Build per-user data
    const userBreakdown = residents.map((u) => {
      const userBills = bills.filter((b) => b.userId === u.id);
      const billTotal = userBills.reduce((s, b) => s + b.totalAmount, 0);
      const billPaid = userBills.reduce((s, b) => s + b.paidAmount, 0);
      const billDue = userBills.reduce((s, b) => s + b.dueAmount, 0);

      // Direct deposits (approved payments not linked to a specific bill)
      const directDeposit = userPayments
        .filter((p) => p.userId === u.id)
        .reduce((s, p) => s + p.amount, 0);

      const totalDeposit = billPaid + directDeposit;
      const needToPay = Math.max(0, billDue);

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        room: u.room,
        avatarUrl: u.avatarUrl,
        billTotal,
        deposit: totalDeposit,
        needToPay,
        hasBills: userBills.length > 0,
      };
    });

    return ok({
      totalDeposit,
      totalExpenses,
      remainingFund,
      totalRefunded,
      month,
      year,
      users: userBreakdown,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
