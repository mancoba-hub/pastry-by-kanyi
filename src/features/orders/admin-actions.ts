"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { updateOrderStatus } from "@/server/repositories/order-repository";
import { orderUpdateFormSchema, zodFields, type ActionState } from "@/features/admin/schema";

/**
 * Order admin actions.
 *
 * Status changes here are what the customer sees on their order page, so the
 * affected paths are revalidated immediately rather than waiting for the cache
 * lifetime to lapse.
 */

function failure(message: string, fields?: Record<string, string[]>): ActionState {
  return { ok: false, message, ...(fields ? { fields } : {}) };
}

export async function updateOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow("ADMIN");

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return failure("Missing order reference.");

  const parsed = orderUpdateFormSchema.safeParse({
    status: formData.get("status"),
    paymentStatus: formData.get("paymentStatus"),
    paymentMethod: formData.get("paymentMethod"),
    internalNotes: formData.get("internalNotes") ?? undefined,
  });

  if (!parsed.success) {
    return failure("Please check the highlighted fields.", zodFields(parsed.error.issues));
  }

  const previous = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, publicRef: true },
  });

  if (!previous) return failure("That order no longer exists.");

  try {
    const updated = await updateOrderStatus(orderId, {
      status: parsed.data.status,
      paymentStatus: parsed.data.paymentStatus,
      paymentMethod: parsed.data.paymentMethod,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    });

    // An order-status change is worth an audit trail: "who marked this
    // delivered, and when" is a real question when money is involved.
    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "order.status_changed",
        entityType: "Order",
        entityId: orderId,
        metadata: {
          publicRef: previous.publicRef,
          from: previous.status,
          to: updated.status,
        },
      },
    });

    // The customer's order page is dynamic, but the admin views are cached.
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin");

    logger.info("admin.order.updated", {
      userId: user.id,
      orderId,
      publicRef: previous.publicRef,
      from: previous.status,
      to: updated.status,
    });

    return { ok: true, message: `Order ${updated.publicRef} updated.` };
  } catch (error) {
    logger.error("admin.order.update.failed", { userId: user.id, orderId, error });
    return failure("We couldn't update that order. Please try again.");
  }
}
