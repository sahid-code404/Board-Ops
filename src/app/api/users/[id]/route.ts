import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ok, err, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notify";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["APPROVE", "SUSPEND", "ACTIVATE", "DEACTIVATE", "ARCHIVE", "RESTORE", "ASSIGN_ROLE"]),
  role: z.string().optional(),
  reason: z.string().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("SUPER_ADMIN", "ADMIN");
    const { id } = await ctx.params;
    const body = await req.json();
    const { action, role, reason } = actionSchema.parse(body);

    const user = await db.user.findUnique({ where: { id } });
    if (!user) return err("User not found", 404);
    if (user.role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN")
      return err("Cannot modify a Super Admin", 403);

    let newStatus = user.status;
    let newRole = user.role;
    let notifyType: "SUCCESS" | "WARNING" | "DANGER" | "INFO" = "INFO";
    let notifyTitle = "";
    let notifyDesc = "";

    switch (action) {
      case "APPROVE":
        newStatus = "ACTIVE";
        notifyType = "SUCCESS";
        notifyTitle = "Account Approved";
        notifyDesc = "Your account has been approved. Welcome to BoardOps!";
        break;
      case "SUSPEND":
        newStatus = "SUSPENDED";
        notifyType = "DANGER";
        notifyTitle = "Account Suspended";
        notifyDesc = reason || "Your account has been suspended. Contact administration.";
        break;
      case "ACTIVATE":
        newStatus = "ACTIVE";
        notifyType = "SUCCESS";
        notifyTitle = "Account Activated";
        notifyDesc = "Your account is now active.";
        break;
      case "DEACTIVATE":
        newStatus = "INACTIVE";
        notifyType = "WARNING";
        notifyTitle = "Account Deactivated";
        notifyDesc = reason || "Your account has been deactivated.";
        break;
      case "ARCHIVE":
        newStatus = "ARCHIVED";
        notifyType = "WARNING";
        notifyTitle = "Account Archived";
        notifyDesc = reason || "Your account has been archived.";
        break;
      case "RESTORE":
        newStatus = "ACTIVE";
        notifyType = "SUCCESS";
        notifyTitle = "Account Restored";
        notifyDesc = "Your account has been restored.";
        break;
      case "ASSIGN_ROLE":
        if (!role) return err("Role is required", 400);
        newRole = role;
        notifyType = "INFO";
        notifyTitle = "Role Updated";
        notifyDesc = `Your role is now ${role}.`;
        break;
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: newStatus, role: newRole },
    });

    if (notifyTitle) {
      await createNotification({
        userId: id,
        title: notifyTitle,
        description: notifyDesc,
        type: notifyType,
        priority: "HIGH",
        route: "dashboard",
      });
    }

    await logAudit({
      actorId: admin.id,
      action: `USER_${action}`,
      entity: "User",
      entityId: id,
      oldValue: { status: user.status, role: user.role },
      newValue: { status: newStatus, role: newRole, reason },
      reason,
    });

    return ok({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
