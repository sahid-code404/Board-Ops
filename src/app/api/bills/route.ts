import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import { purgeExpiredBills, getDeletionDate } from "@/lib/user-cleanup";
import { recomputeBillPaidState } from "@/lib/bill-sync";

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
    // Optional custom due date from the admin. If omitted, existing bills keep
    // their current due date; new bills default to the 10th of next month.
    const customDueDate = body.dueDate ? new Date(body.dueDate) : null;
    const defaultDueDate = new Date(year, month + 1, 10);
    const dueDate = customDueDate && !isNaN(customDueDate.getTime())
      ? customDueDate
      : null; // null = use existing or default

    const activeUsers = await db.user.findMany({
      where: { status: "ACTIVE", role: "USER" },
    });

    // Load meal rates from variables (DB-driven)
    const rateVars = await db.variable.findMany({
      where: { key: { startsWith: "meal.rate." }, status: "ACTIVE" },
    });
    const rateMap: Record<string, number> = {};
    rateVars.forEach((v) => {
      const mealName = v.key.replace("meal.rate.", "");
      rateMap[mealName] = Number(v.value) || 0;
    });

    const roomRentVar = await db.variable.findUnique({ where: { key: "billing.roomRent" } });
    const cleaningVar = await db.variable.findUnique({ where: { key: "billing.cleaningCharges" } });
    const roomRent = roomRentVar ? Number(roomRentVar.value) : 0;
    const cleaning = cleaningVar ? Number(cleaningVar.value) : 0;

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const meals = await db.mealConfiguration.findMany();
    const mealNameById: Record<string, string> = {};
    meals.forEach((m) => (mealNameById[m.id] = m.name));

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

      const mealCharges = Object.entries(counts).reduce(
        (sum, [name, count]) => sum + (rateMap[name] || 0) * count,
        0
      );
      const otherCharges = roomRent + cleaning;
      const totalAmount = mealCharges + otherCharges;
      const snapshot = JSON.stringify({ counts, rates: rateMap, roomRent, cleaning });

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
