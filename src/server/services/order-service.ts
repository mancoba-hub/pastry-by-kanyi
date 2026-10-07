import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sumCents } from "@/lib/money";
import { generateOrderRef } from "@/lib/ids";
import { failure, ok, zodToFieldErrors, type Result, type Failure } from "@/lib/result";
import { orderRateLimiter } from "@/lib/rate-limit";
import * as orders from "@/server/repositories/order-repository";
import { findCakesForOrder } from "@/server/repositories/cake-repository";
import { findProductsByIds } from "@/server/repositories/product-repository";
import {
  checkoutLineSchema,
  checkoutSchema,
  earliestRequestedDate,
  LEAD_TIME_HOURS,
  type CheckoutLine,
} from "@/features/orders/schema";
import type { OrderDetail } from "@/server/repositories/order-repository";
import { z } from "zod";

/**
 * Order service.
 *
 * The only unauthenticated write path on the site, so it is guarded on three
 * levels: schema validation, server-side price resolution, and rate limiting.
 *
 * Flow: parse → resolve catalog → price → persist (with outbox) → return.
 */

export type PlaceOrderContext = {
  /** Client IP, for rate limiting. */
  clientKey: string;
  channel?: "WEB" | "WHATSAPP" | "INSTAGRAM" | "PHONE" | "WALK_IN";
};

type ResolvedLine = {
  kind: "CAKE" | "PRODUCT";
  cakeId: string | null;
  productId: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Presentation fields, carried so the basket can render without a second query. */
  slug: string;
  imageUrl: string | null;
};

/**
 * Turns validated line intentions into priced lines by reading the catalog.
 *
 * Every failure here is an expected, user-correctable condition (item removed,
 * sold out, price not set) and is returned as a `Failure` rather than thrown, so
 * the checkout page can render a specific, actionable message.
 */
async function resolveLines(
  items: CheckoutLine[],
): Promise<Result<{ lines: ResolvedLine[]; subtotalCents: number }, Failure>> {
  const cakeIds = [...new Set(items.filter((i) => i.kind === "CAKE").map((i) => i.id))];
  const productIds = [...new Set(items.filter((i) => i.kind === "PRODUCT").map((i) => i.id))];

  // Two queries regardless of basket size — never one query per line.
  const [cakeRows, productRows] = await Promise.all([
    findCakesForOrder(cakeIds),
    findProductsByIds(productIds),
  ]);

  const cakeMap = new Map(cakeRows.map((c) => [c.id, c]));
  const productMap = new Map(productRows.map((p) => [p.id, p]));
  const lines: ResolvedLine[] = [];

  for (const line of items) {
    if (line.kind === "CAKE") {
      const cake = cakeMap.get(line.id);

      if (!cake) {
        return failure("CONFLICT", "One of the cakes in your basket is no longer available.", {
          items: ["A cake in your basket is no longer listed."],
        });
      }

      // A portfolio cake without a listed price is an enquiry, not a purchase.
      if (cake.priceCents == null) {
        return failure(
          "VALIDATION",
          `"${cake.title}" is priced on request — please enquire on WhatsApp instead.`,
          { items: [`"${cake.title}" needs a custom quote.`] },
        );
      }

      lines.push({
        kind: "CAKE",
        cakeId: cake.id,
        productId: null,
        nameSnapshot: cake.title,
        unitPriceCents: cake.priceCents,
        quantity: line.quantity,
        lineTotalCents: cake.priceCents * line.quantity,
        slug: cake.slug,
        imageUrl: cake.images[0]?.url ?? null,
      });

      continue;
    }

    const product = productMap.get(line.id);

    if (!product || product.status !== "ACTIVE") {
      return failure("CONFLICT", "One of the items in your basket is no longer available.", {
        items: ["An item in your basket is no longer for sale."],
      });
    }

    if (line.quantity > product.maxPerOrder) {
      return failure(
        "VALIDATION",
        `We can only take ${product.maxPerOrder} × ${product.name} per order.`,
        { items: [`Reduce ${product.name} to ${product.maxPerOrder} or fewer.`] },
      );
    }

    // `stockQty === null` means baked to order, i.e. unlimited.
    if (product.stockQty !== null && product.stockQty < line.quantity) {
      return failure(
        "CONFLICT",
        product.stockQty === 0
          ? `${product.name} is sold out.`
          : `Only ${product.stockQty} × ${product.name} left today.`,
        { items: [`${product.name}: ${product.stockQty} remaining.`] },
      );
    }

    lines.push({
      kind: "PRODUCT",
      cakeId: null,
      productId: product.id,
      nameSnapshot: product.name,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
      lineTotalCents: product.priceCents * line.quantity,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
    });
  }

  return ok({ lines, subtotalCents: sumCents(lines.map((l) => l.lineTotalCents)) });
}

/**
 * Prices a basket without creating an order.
 *
 * The cart and the checkout call this same function, so what the customer sees
 * in the basket is computed by exactly the code that will charge them. Keeping
 * a separate "display price" path is how basket and receipt totals drift apart.
 */
export async function priceBasket(
  rawItems: unknown,
  fulfilment: "PICKUP" | "DELIVERY" = "PICKUP",
): Promise<
  Result<
    {
      lines: ResolvedLine[];
      subtotalCents: number;
      deliveryFeeCents: number;
      totalCents: number;
    },
    Failure
  >
> {
  const parsed = z.array(checkoutLineSchema).min(1, "Your basket is empty.").max(30).safeParse(rawItems);

  if (!parsed.success) {
    return failure("VALIDATION", "Your basket could not be read.", zodToFieldErrors(parsed.error));
  }

  const resolved = await resolveLines(parsed.data);
  if (!resolved.ok) return resolved;

  const deliveryFeeCents = fulfilment === "DELIVERY" ? publicEnv.deliveryFeeCents : 0;

  return ok({
    lines: resolved.value.lines,
    subtotalCents: resolved.value.subtotalCents,
    deliveryFeeCents,
    totalCents: resolved.value.subtotalCents + deliveryFeeCents,
  });
}

export async function placeOrder(
  rawInput: unknown,
  context: PlaceOrderContext,
): Promise<Result<OrderDetail, Failure>> {
  const limit = orderRateLimiter.check(context.clientKey);
  if (!limit.allowed) {
    return failure(
      "RATE_LIMITED",
      `Too many orders from this device. Please try again in ${limit.retryAfterSeconds} seconds, or message us on WhatsApp.`,
    );
  }

  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    return failure("VALIDATION", "Please check the highlighted fields.", zodToFieldErrors(parsed.error));
  }

  const input = parsed.data;

  // A retried submission must return the original order, not create a second one.
  if (input.idempotencyKey) {
    const existing = await orders.findOrderByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      logger.info("order.idempotent_replay", { publicRef: existing.publicRef });
      return ok(existing);
    }
  }

  /**
   * `now` is read exactly once.
   *
   * Reading the clock twice (once for the default and once for the boundary)
   * makes the comparison non-deterministic: the second read is always a little
   * later, so an order that omits `requestedFor` could be rejected for being a
   * few microseconds short of the lead time. It passed in fast code paths and
   * failed under load — the worst kind of bug.
   */
  const now = new Date();
  const earliest = earliestRequestedDate(now);

  // An unset requestedFor means "as soon as possible", which still respects lead time.
  const requestedFor = input.requestedFor ?? earliest;

  if (requestedFor.getTime() < earliest.getTime()) {
    return failure(
      "VALIDATION",
      `Cakes need at least ${LEAD_TIME_HOURS} hours' notice. The earliest we can do is ${earliest.toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}.`,
      { requestedFor: [`Choose a date at least ${LEAD_TIME_HOURS} hours from now.`] },
    );
  }

  const resolved = await resolveLines(input.items);
  if (!resolved.ok) return resolved;

  const { lines, subtotalCents } = resolved.value;

  const deliveryFeeCents = input.fulfilment === "DELIVERY" ? publicEnv.deliveryFeeCents : 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  const created = await orders.createOrder({
    publicRef: generateOrderRef(),
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail?.trim() ? input.customerEmail : null,
    fulfilment: input.fulfilment,
    deliveryAddress: input.fulfilment === "DELIVERY" ? (input.deliveryAddress ?? null) : null,
    requestedFor,
    notes: input.notes?.trim() ? input.notes : null,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
    paymentMethod: "CASH_ON_DELIVERY",
    channel: context.channel ?? "WEB",
    idempotencyKey: input.idempotencyKey ?? null,
    items: lines.map((line) => ({
      kind: line.kind,
      cakeId: line.cakeId,
      productId: line.productId,
      nameSnapshot: line.nameSnapshot,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
    })),
  });

  logger.info("order.placed", {
    publicRef: created.publicRef,
    totalCents,
    itemCount: lines.length,
    fulfilment: input.fulfilment,
  });

  return ok(created);
}

export async function getOrderByRef(publicRef: string): Promise<OrderDetail | null> {
  return orders.findOrderByRef(publicRef.trim().toUpperCase());
}

/** Orders needing action, for the dashboard. */
export async function getOpenOrders(limit = 8) {
  return orders.listOpenOrders(limit);
}

export async function getOrderStats() {
  const counts = await orders.countOrdersByStatus();

  return {
    pending: counts.PENDING ?? 0,
    inProgress: (counts.CONFIRMED ?? 0) + (counts.BAKING ?? 0) + (counts.READY ?? 0) + (counts.OUT_FOR_DELIVERY ?? 0),
    completed: counts.COMPLETED ?? 0,
    cancelled: counts.CANCELLED ?? 0,
  };
}
