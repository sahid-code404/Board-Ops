import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import { purgeExpiredBills, getDeletionDate } from "@/lib/user-cleanup";
import { recomputeBillPaidState } from "@/lib/bill-sync";
import { getReadiness } from "@/lib/monthly-closing";

/** GET /api/bills — list bills (user sees own; admin sees all).
 *  Optional `month` and `year` query params filter by billing period.
 *  Optional `includeDeleted=true` shows soft-deleted bills (deletion queue).
 *  Soft-deleted bills (in 7-day queue) are excluded by default. */
export async function GET(req: Request) {
  try {
    // Purge bills whose 7-day grace period has expired
    await purgeExpiredBills();

    const user = await requireAuth();
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 200);
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";

    const where: Record<string, unknown> = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    } else {
      where.deletedAt = { not: null };
    }
    if (user.role === "USER") {
      where.userId = user.id;
    }
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");
    if (month !== null && year) {
      where.periodMonth = Number(month);
      where.periodYear = Number(year);
    }

    // Exclude future-period bills (e.g. July 2027 when we're in June 2026).
    // Used by the Submit Payment dialog so users only see current/past bills.
    const excludeFuture = url.searchParams.get("future") === "false";
    if (excludeFuture) {
      const now = new Date();
      const currentPeriod = now.getFullYear() * 12 + now.getMonth();
      // periodMonth is 0-indexed (0=Jan), periodYear is the year
      where.AND = [
        { OR: [
          { periodYear: { lt: now.getFullYear() } },
          { periodYear: now.getFullYear(), periodMonth: { lte: now.getMonth() } },
        ]},
      ];
    }
    // Exclude bills for admin users — admins are not residents
    where.user = { role: "USER" };

    const bills = await db.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true, email: true, room: true, avatarUrl: true } } },
    });
    return ok(bills);
  } catch (e) {
    return handleApiError(e);
  }
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** POST /api/bills/generate — generate or refresh bills for a billing period.
 *  Admins can run this multiple times. Existing non-void, non-deleted bills are
 *  re-calculated (meal charges updated from current meal entries) while payment
 *  history is preserved (paidAmount kept, dueAmount + status recomputed). */
export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const month = Number(body.month ?? new Date().getMonth());
    const year = Number(body.year ?? new Date().getFullYear());
    const periodLabel = `${MONTHS[month] ?? `Month ${month + 1}`} ${year}`;

    // PRD: Bill generation requires ALL readiness items to be "ready" — no errors AND no warnings.
    // Admins must resolve all issues (missing expenses, invalid formula, pending payments, etc.)
    // before bills can be generated.
    const readiness = await getReadiness(month, year);
    if (!readiness.canClose) {
      const issues = readiness.items
        .filter((i) => i.status !== "ready")
        .map((i) => `${i.label}: ${i.detail}`);
      return err(
        `Cannot generate bills for ${periodLabel}. Resolve all issues first:\n${issues.join("\n")}`,
        422
      );
    }

    // Optional custom due date from the admin. If omitted, existing bills keep
    // their current due date; new bills default to the 10th of next month.
    const customDueDate = body.dueDate ? new Date(body.dueDate) : null;
    // Read due date day from policy variable (default 10th)
    const dueDateDayVar = await db.variable.findUnique({ where: { key: "policy.billing.dueDateDay" } });
    const dueDateDay = dueDateDayVar ? parseInt(dueDateDayVar.value) || 10 : 10;
    const defaultDueDate = new Date(year, month + 1, dueDateDay);
    const dueDate = customDueDate && !isNaN(customDueDate.getTime())
      ? customDueDate
      : null; // null = use existing or default

    const activeUsers = await db.user.findMany({
      where: { status: "ACTIVE", role: "USER" },
    });

    // PRD: Meal charge is a SINGLE dynamic value = (Total Expenses - Guest Revenue) / Total Resident Meals
    // NOT fixed per-meal rates. Calculated from the month's actual expenses and meal counts.
    const roomRentVar = await db.variable.findUnique({ where: { key: "billing.roomRent" } });
    const cleaningVar = await db.variable.findUnique({ where: { key: "billing.cleaningCharges" } });
    const roomRent = roomRentVar ? Number(roomRentVar.value) : 0;
    const cleaning = cleaningVar ? Number(cleaningVar.value) : 0;

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Calculate total expenses for the period
    const expenses = await db.expense.findMany({
      where: { expenseDate: { gte: start, lte: end }, deletedAt: null, status: { not: "DELETED" } },
      select: { amount: true },
    });
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Calculate total resident meals + guest meals for the period
    const meals = await db.mealConfiguration.findMany();
    const mealNameById: Record<string, string> = {};
    meals.forEach((m) => (mealNameById[m.id] = m.name));

    // Exclude admin users' meals — only resident meals count
    const allMealEntries = await db.mealEntry.findMany({
      where: { serviceDate: { gte: start, lte: end }, status: { in: ["ON", "LOCKED"] }, user: { role: "USER" } },
    });
    const totalResidentMeals = allMealEntries.length;

    // Guest meals + revenue
    const guestMeals = await db.guestMeal.findMany({
      where: { serviceDate: { gte: start, lte: end } },
      include: { meal: true },
    });
    let totalGuestMeals = 0;
    let guestRevenue = 0;
    // Load guest meal charge variable if it exists
    const guestChargeVar = await db.variable.findUnique({ where: { key: "billing.guestMealCharge" } });
    const guestChargePerMeal = guestChargeVar ? Number(guestChargeVar.value) : 0;
    for (const g of guestMeals) {
      totalGuestMeals += g.guestCount || 1;
      guestRevenue += (g.guestCount || 1) * guestChargePerMeal;
    }

    // PRD: per-meal charge = (Total Expenses - Guest Revenue) / Total Resident Meals
    const perMealCharge = totalResidentMeals > 0
      ? Math.max(0, (totalExpenses - guestRevenue) / totalResidentMeals)
      : 0;

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const u of activeUsers) {
      const existing = await db.bill.findUnique({
        where: { userId_periodMonth_periodYear: { userId: u.id, periodMonth: month, periodYear: year } },
      });

      // Skip VOID bills (deliberately voided by admin — don't resurrect via generation)
      // and soft-deleted bills (use the restore endpoint instead).
      if (existing && (existing.status === "VOID" || existing.deletedAt)) {
        skipped++;
        continue;
      }

      const entries = await db.mealEntry.findMany({
        where: { userId: u.id, serviceDate: { gte: start, lte: end } },
      });
      const counts: Record<string, number> = {};
      entries.forEach((e) => {
        if (e.status === "ON" || e.status === "LOCKED") {
          const name = mealNameById[e.mealId] || "unknown";
          counts[name] = (counts[name] || 0) + 1;
        }
      });

      // PRD: meal charges = resident's total meal count × per-meal charge (dynamic, not fixed rates)
      const residentMealCount = Object.values(counts).reduce((s, c) => s + c, 0);
      const mealCharges = Math.round(residentMealCount * perMealCharge);
      const otherCharges = roomRent + cleaning;
      const totalAmount = mealCharges + otherCharges;
      const snapshot = JSON.stringify({
        counts,
        residentMealCount,
        perMealCharge,
        mealCharges,
        roomRent,
        cleaning,
        totalExpenses,
        guestRevenue,
        totalResidentMeals,
      });

      if (existing) {
        // Recalculate on an existing bill — preserve paidAmount, recompute due + status.
        // After writing, call recomputeBillPaidState to guarantee paidAmount matches
        // the actual APPROVED payments on this bill (defensive — catches any drift
        // from manual DB edits or prior bugs).
        const paidAmount = existing.paidAmount;
        const dueAmount = Math.max(0, totalAmount - paidAmount);
        let newStatus: string;
        if (totalAmount > 0 && paidAmount >= totalAmount) {
          newStatus = "PAID";
        } else if (paidAmount > 0) {
          newStatus = "PARTIALLY_PAID";
        } else {
          newStatus = "GENERATED";
        }

        // Due date: use the new one if provided, otherwise keep the existing one,
        // otherwise fall back to the default.
        const effectiveDueDate = dueDate ?? existing.dueDate ?? defaultDueDate;

        await db.bill.update({
          where: { id: existing.id },
          data: {
            mealCharges,
            otherCharges,
            totalAmount,
            dueAmount,
            status: newStatus,
            generatedAt: new Date(),
            dueDate: effectiveDueDate,
            snapshot,
          },
        });
        // Re-sync paid/due/status from actual APPROVED payments (authoritative)
        await recomputeBillPaidState(existing.id);
        updated++;

        // Notify the user when their bill amount increased (e.g. more meals added
        // after the initial generation). Skip no-op regenerations and decreases
        // (decreases are usually followed by a refund or adjustment notification).
        if (totalAmount > existing.totalAmount) {
          const diff = totalAmount - existing.totalAmount;
          await createNotification({
            userId: u.id,
            title: "Bill updated",
            description: `Your ${periodLabel} bill increased by ₹${Math.round(diff)} — new total ₹${Math.round(totalAmount)}.`,
            type: "WARNING",
            priority: "HIGH",
            route: "billing",
          });
        }
      } else {
        // Create a new bill for this period
        await db.bill.create({
          data: {
            userId: u.id,
            periodMonth: month,
            periodYear: year,
            mealCharges,
            otherCharges,
            totalAmount,
            paidAmount: 0,
            dueAmount: totalAmount,
            status: "GENERATED",
            generatedAt: new Date(),
            dueDate: dueDate ?? defaultDueDate,
            snapshot,
          },
        });
        created++;

        // Notify the user that their bill is ready
        const billDueDate = dueDate ?? defaultDueDate;
        const dueLabel = billDueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        await createNotification({
          userId: u.id,
          title: "Bill generated",
          description: `Your ${periodLabel} bill of ₹${Math.round(totalAmount)} is now available. Due ${dueLabel}.`,
          type: "INFO",
          priority: "HIGH",
          route: "billing",
        });
      }
    }

    const generated = created + updated;

    await logAudit({
      actorId: user.id,
      action: "BILLS_GENERATED",
      entity: "Bill",
      newValue: { generated, created, updated, skipped, month, year },
    });
    return ok({ generated, created, updated, skipped, month, year });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/bills — soft-delete all bills (schedule for permanent deletion after 7 days) */
export async function DELETE(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");
    const body = await req.json().catch(() => ({}));
    const reason = (body as { reason?: string }).reason;

    const where: Record<string, unknown> = { deletedAt: null };
    if (month !== null && year) {
      where.periodMonth = Number(month);
      where.periodYear = Number(year);
    }

    const deletionDate = getDeletionDate();
    const result = await db.bill.updateMany({
      where,
      data: { deletedAt: deletionDate, deletedBy: user.id, status: "DELETED", deletionReason: reason || null },
    });

    await logAudit({
      actorId: user.id,
      action: "BILLS_SOFT_DELETED_ALL",
      entity: "Bill",
      newValue: { scheduled: result.count, permanentDeletion: deletionDate, month, year, reason },
      reason,
    });

    return ok({ deleted: result.count, permanentDeletion: deletionDate.toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}
