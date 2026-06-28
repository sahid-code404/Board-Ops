import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { purgeExpiredBills, getDeletionDate } from "@/lib/user-cleanup";

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

/** POST /api/bills/generate — generate bills for current period for all active users */
export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const month = Number(body.month ?? new Date().getMonth());
    const year = Number(body.year ?? new Date().getFullYear());

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

    let generated = 0;
    for (const u of activeUsers) {
      const existing = await db.bill.findUnique({
        where: { userId_periodMonth_periodYear: { userId: u.id, periodMonth: month, periodYear: year } },
      });
      if (existing && existing.status !== "DRAFT") continue;

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
      const dueDate = new Date(year, month + 1, 10);

      const snapshot = JSON.stringify({ counts, rates: rateMap, roomRent, cleaning });

      if (existing) {
        await db.bill.update({
          where: { id: existing.id },
          data: {
            mealCharges,
            otherCharges,
            totalAmount,
            dueAmount: totalAmount - existing.paidAmount,
            status: "GENERATED",
            generatedAt: new Date(),
            dueDate,
            snapshot,
          },
        });
      } else {
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
            dueDate,
            snapshot,
          },
        });
      }
      generated++;
    }

    await logAudit({
      actorId: user.id,
      action: "BILLS_GENERATED",
      entity: "Bill",
      newValue: { generated, month, year },
    });
    return ok({ generated, month, year });
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
