import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import { computeEditableUntil } from "@/lib/meal-engine";
import { z } from "zod";

const overrideSchema = z.object({
  mealId: z.string(),
  userId: z.string(),
  serviceDate: z.string().transform((s) => new Date(s)),
  action: z.enum(["TURN_ON", "TURN_OFF", "LOCK", "UNLOCK"]),
  reason: z.string().min(3, "Reason is required"),
});

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const body = await req.json();
    const data = overrideSchema.parse(body);

    const meal = await db.mealConfiguration.findUnique({ where: { id: data.mealId } });
    if (!meal) return err("Meal not found", 404);

    const entry = await db.mealEntry.findFirst({
      where: { userId: data.userId, mealId: data.mealId, serviceDate: data.serviceDate },
    });

    if (!entry) {
      const editableUntil = computeEditableUntil(meal, data.serviceDate);
      const newStatus = data.action === "TURN_OFF" ? "OFF" : "ON";
      const originalState = meal.defaultState === "ON" ? "ON" : "OFF";
      // Override is TRUE only if current differs from original
      const overrideFlag = newStatus !== originalState;
      const newEntry = await db.mealEntry.create({
        data: {
          userId: data.userId,
          mealId: data.mealId,
          serviceDate: data.serviceDate,
          status: newStatus,
          originalState,
          editableUntil,
          locked: false,
          overrideFlag,
          updatedBy: admin.id,
        },
      });
      await db.mealOverride.create({
        data: {
          mealId: data.mealId,
          userId: data.userId,
          serviceDate: data.serviceDate,
          action: data.action,
          reason: data.reason,
          adminId: admin.id,
        },
      });
      await createNotification({
        userId: data.userId,
        title: "Meal modified by Administrator",
        description: `${meal.displayName} on ${data.serviceDate.toDateString()} was changed (${data.action}). Reason: ${data.reason}`,
        type: "WARNING",
        priority: "HIGH",
        route: "meals",
      });
      await logAudit({
        actorId: admin.id,
        action: "MEAL_OVERRIDE",
        entity: "MealEntry",
        entityId: newEntry.id,
        newValue: data,
      });
      return ok(newEntry);
    }

    const oldStatus = entry.status;
    // Determine the new status based on the action
    const newStatus =
      data.action === "TURN_ON"
        ? "ON"
        : data.action === "TURN_OFF"
          ? "OFF"
          : data.action === "LOCK"
            ? "LOCKED"
            : entry.status === "LOCKED"
              ? "ON"
              : entry.status;

    // Override is computed dynamically: compare new status with the original state.
    // If they match, the meal is back to its original system value — no override.
    // If they differ, the meal has been overridden from its original state.
    const originalState = entry.originalState || (meal.defaultState === "ON" ? "ON" : "OFF");
    const overrideFlag = newStatus !== originalState;

    const updated = await db.mealEntry.update({
      where: { id: entry.id },
      data: {
        status: newStatus,
        originalState, // preserve the original state (never change it)
        overrideFlag,
        locked: data.action === "LOCK" ? true : false,
        updatedBy: admin.id,
      },
    });

    await db.mealOverride.create({
      data: {
        mealId: data.mealId,
        userId: data.userId,
        serviceDate: data.serviceDate,
        action: data.action,
        reason: data.reason,
        adminId: admin.id,
      },
    });
    await db.mealHistory.create({
      data: {
        mealEntryId: entry.id,
        mealId: data.mealId,
        oldStatus,
        newStatus: updated.status,
        changedBy: admin.id,
        triggerSource: "OVERRIDE",
        reason: data.reason,
      },
    });
    await createNotification({
      userId: data.userId,
      title: "Meal modified by Administrator",
      description: `${meal.displayName} on ${data.serviceDate.toDateString()} was changed (${data.action}). Reason: ${data.reason}`,
      type: "WARNING",
      priority: "HIGH",
      route: "meals",
    });
    await logAudit({
      actorId: admin.id,
      action: "MEAL_OVERRIDE",
      entity: "MealEntry",
      entityId: entry.id,
      oldValue: { status: oldStatus },
      newValue: { status: updated.status, action: data.action, reason: data.reason },
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
