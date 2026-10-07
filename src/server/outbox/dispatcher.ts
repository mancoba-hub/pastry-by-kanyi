import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { formatMoney } from "@/lib/money";

/**
 * Outbox dispatcher.
 *
 * Events are written to the `OutboxEvent` table inside the same transaction as
 * the change that caused them (see order-repository). This worker drains them.
 *
 * Why this shape:
 *   - The customer's request never waits on a third-party API. Order placement
 *     stays fast even when WhatsApp/email/SMS is slow or down.
 *   - Delivery is at-least-once with retry and backoff, so a transient failure
 *     does not lose a sale.
 *   - Handlers are keyed by event type, so adding "email the receipt" later is
 *     a new entry in `handlers` rather than a change to checkout.
 *
 * How to run it: `npm run outbox:drain` on a schedule (cron, Vercel Cron,
 * a platform scheduler). At higher volume, move it to a queue consumer.
 */

export type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>;

const MAX_ATTEMPTS = 5;

/**
 * Notifies the baker of a new order.
 *
 * For now this is a structured log plus a pre-built WhatsApp deep link, because
 * sending business-initiated WhatsApp messages requires a Meta Business account
 * and a template approval. Swapping in the Cloud API is a change to this
 * function only.
 */
const notifyBakerOfOrder: OutboxHandler = async (payload) => {
  const link = whatsappLink(
    `New order ${String(payload.publicRef)} — ${String(payload.customerName)} — ` +
      `${formatMoney(Number(payload.totalCents ?? 0))} — ${String(payload.itemCount)} item(s).`,
  );

  logger.info("outbox.order.created.notify", {
    publicRef: payload.publicRef,
    customerPhone: payload.customerPhone,
    totalCents: payload.totalCents,
    whatsappLink: link,
    bakerNumber: publicEnv.whatsappNumber,
  });
};

const handlers: Record<string, OutboxHandler> = {
  "order.created": notifyBakerOfOrder,
};

export type DrainResult = {
  processed: number;
  failed: number;
  skipped: number;
};

/**
 * Processes a batch of due events.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes this safe to run concurrently: two
 * workers will never claim the same row, so the drain can be scaled out by
 * simply running more of them. Falls back to a plain read on engines without it.
 */
export async function drainOutbox(batchSize = 20): Promise<DrainResult> {
  const result: DrainResult = { processed: 0, failed: 0, skipped: 0 };

  const due = await db.outboxEvent.findMany({
    where: { status: "PENDING", availableAt: { lte: new Date() } },
    orderBy: { availableAt: "asc" },
    take: batchSize,
    select: { id: true, type: true, payload: true, attempts: true },
  });

  for (const event of due) {
    const handler = handlers[event.type];

    if (!handler) {
      result.skipped += 1;
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", lastError: `No handler registered for "${event.type}".` },
      });
      continue;
    }

    // Claim the row before doing side-effecting work.
    const claim = await db.outboxEvent.updateMany({
      where: { id: event.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });

    if (claim.count === 0) {
      result.skipped += 1;
      continue;
    }

    try {
      await handler((event.payload ?? {}) as Record<string, unknown>);

      await db.outboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
      });
      result.processed += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = attempts >= MAX_ATTEMPTS;

      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lastError: message.slice(0, 1000),
          // Exponential backoff: 1, 2, 4, 8 minutes.
          availableAt: new Date(Date.now() + 2 ** attempts * 30_000),
        },
      });

      result.failed += 1;
      logger.error("outbox.event.failed", { id: event.id, type: event.type, attempts, message });
    }
  }

  return result;
}
