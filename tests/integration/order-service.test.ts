import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { placeOrder, priceBasket, getOrderByRef } from "@/server/services/order-service";
import { publicEnv } from "@/lib/env";
import { LEAD_TIME_HOURS } from "@/features/orders/schema";
import { uniqueSlug } from "@/lib/slug";

/**
 * Order service integration tests.
 *
 * These run against a real MariaDB because the behaviour that matters most —
 * that a client cannot dictate prices — is only meaningful when the catalog is
 * actually being read. A mocked repository would happily "prove" the wrong thing.
 *
 * Each test uses its own client key so the shared in-memory rate limiter does
 * not leak between tests, and all fixtures are removed in `afterAll`.
 */

const RUN_ID = Date.now().toString(36);
const createdCakeIds: string[] = [];
const createdProductIds: string[] = [];
const createdOrderIds: string[] = [];

let cakeId: string;
let freeCakeId: string;
let productId: string;
let soldOutProductId: string;

async function makeCake(opts: {
  title: string;
  priceCents: number | null;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}) {
  const slug = uniqueSlug(`test-${opts.title}-${RUN_ID}`, () => false);

  const cake = await db.cake.create({
    data: {
      slug,
      title: opts.title,
      description: "Fixture cake created by the order service integration test.",
      status: opts.status ?? "PUBLISHED",
      priceCents: opts.priceCents,
      bakedAt: new Date(),
      tags: { create: [{ label: "Test", slug: `test-${RUN_ID}` }] },
    },
    select: { id: true },
  });

  createdCakeIds.push(cake.id);
  return cake.id;
}

async function makeProduct(opts: {
  name: string;
  priceCents: number;
  status?: "DRAFT" | "ACTIVE" | "SOLD_OUT" | "ARCHIVED";
  stockQty?: number | null;
  maxPerOrder?: number;
}) {
  const product = await db.product.create({
    data: {
      slug: uniqueSlug(`test-${opts.name}-${RUN_ID}`, () => false),
      name: opts.name,
      description: "Fixture product created by the order service integration test.",
      priceCents: opts.priceCents,
      unitLabel: "pack of 6",
      status: opts.status ?? "ACTIVE",
      stockQty: opts.stockQty ?? null,
      maxPerOrder: opts.maxPerOrder ?? 10,
    },
    select: { id: true },
  });

  createdProductIds.push(product.id);
  return product.id;
}

beforeAll(async () => {
  cakeId = await makeCake({ title: "Chocolate Celebration", priceCents: 85_000 });
  freeCakeId = await makeCake({ title: "Quote Only", priceCents: null });
  productId = await makeProduct({ name: "Buttermilk Scones", priceCents: 7_500 });
  soldOutProductId = await makeProduct({
    name: "Sold Out Scones",
    priceCents: 8_000,
    status: "SOLD_OUT",
    stockQty: 0,
  });
});

afterAll(async () => {
  // Orders first: items reference cakes and products with `onDelete: SetNull`,
  // but deleting children explicitly keeps the intent obvious.
  if (createdOrderIds.length > 0) {
    // The outbox row is written in the same transaction as the order, but it
    // carries the order id inside a JSON payload rather than as a foreign key,
    // so deleting the order alone would quietly orphan the event and every test
    // run would leave a growing pile behind. Clear both.
    const events = await db.outboxEvent.findMany({
      where: {
        OR: createdOrderIds.map((id) => ({ payload: { path: "$.orderId", equals: id } })),
      },
      select: { id: true },
    });

    if (events.length > 0) {
      await db.outboxEvent.deleteMany({ where: { id: { in: events.map((event) => event.id) } } });
    }

    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (createdCakeIds.length > 0) {
    await db.cake.deleteMany({ where: { id: { in: createdCakeIds } } });
  }
  if (createdProductIds.length > 0) {
    await db.product.deleteMany({ where: { id: { in: createdProductIds } } });
  }
});

function validOrder(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Thandi Mokoena",
    customerPhone: "082 123 4567",
    fulfilment: "PICKUP",
    items: [{ kind: "CAKE", id: cakeId, quantity: 1 }],
    ...overrides,
  };
}

/** Unique per test so the shared rate limiter never interferes. */
function client(scope: string) {
  return { clientKey: `test:${RUN_ID}:${scope}` };
}

describe("placeOrder", () => {
  it("prices from the catalog, not from the request", async () => {
    const result = await placeOrder(
      validOrder({
        items: [{ kind: "CAKE", id: cakeId, quantity: 2, unitPriceCents: 1 }],
        totalCents: 1,
        subtotalCents: 1,
      }),
      client("pricing"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.value.id);

    // 2 × R850 — the client's claimed prices are ignored entirely.
    expect(result.value.subtotalCents).toBe(170_000);
    expect(result.value.totalCents).toBe(170_000);
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].unitPriceCents).toBe(85_000);
    expect(result.value.items[0].lineTotalCents).toBe(170_000);
  });

  it("normalises the phone number to E.164", async () => {
    const result = await placeOrder(validOrder(), client("phone"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.value.id);
    expect(result.value.customerPhone).toBe("+27821234567");
  });

  it("generates an unguessable public reference and starts pending", async () => {
    const result = await placeOrder(validOrder(), client("ref"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.value.id);
    expect(result.value.publicRef).toMatch(/^PBK-[A-Z2-9]{6}$/);
    expect(result.value.status).toBe("PENDING");
    expect(result.value.paymentStatus).toBe("UNPAID");
  });

  it("snapshots the product name and price onto the line", async () => {
    const result = await placeOrder(
      validOrder({ items: [{ kind: "PRODUCT", id: productId, quantity: 3 }] }),
      client("snapshot"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.value.id);

    const line = result.value.items[0];
    expect(line.nameSnapshot).toBe("Buttermilk Scones");
    expect(line.unitPriceCents).toBe(7_500);
    expect(line.lineTotalCents).toBe(22_500);
  });

  it("rejects an order with no lead time", async () => {
    const tooSoon = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const result = await placeOrder(validOrder({ requestedFor: tooSoon }), client("leadtime"));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.fields?.requestedFor).toBeDefined();
  });

  it("accepts an order at exactly the lead time boundary", async () => {
    const ok = new Date(Date.now() + LEAD_TIME_HOURS * 60 * 60 * 1000 + 60_000).toISOString();

    const result = await placeOrder(validOrder({ requestedFor: ok }), client("boundary"));

    expect(result.ok).toBe(true);
    if (result.ok) createdOrderIds.push(result.value.id);
  });

  it("accepts an order with no requestedFor, defaulting to the lead time", async () => {
    // Regression test. `placeOrder` used to read the clock twice — once for the
    // default and once for the boundary — which made an order that omitted the
    // date fail intermittently, because the second read was always a few
    // microseconds later than the value it was compared against.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await placeOrder(validOrder(), client(`default-date-${attempt}`));

      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      createdOrderIds.push(result.value.id);

      const requestedFor = result.value.requestedFor;
      expect(requestedFor).not.toBeNull();
      expect(requestedFor!.getTime()).toBeGreaterThanOrEqual(
        Date.now() + LEAD_TIME_HOURS * 60 * 60 * 1000 - 5_000,
      );
    }
  });

  it("refuses a cake that is priced on request", async () => {
    const result = await placeOrder(
      validOrder({ items: [{ kind: "CAKE", id: freeCakeId, quantity: 1 }] }),
      client("quotecake"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("refuses an item that is not for sale", async () => {
    const result = await placeOrder(
      validOrder({ items: [{ kind: "PRODUCT", id: soldOutProductId, quantity: 1 }] }),
      client("soldout"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });

  it("refuses an unknown id rather than failing silently", async () => {
    const result = await placeOrder(
      validOrder({ items: [{ kind: "CAKE", id: "does-not-exist", quantity: 1 }] }),
      client("unknown"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });

  it("rejects a bad phone number with a field-level error", async () => {
    const result = await placeOrder(validOrder({ customerPhone: "12345" }), client("badphone"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fields?.customerPhone).toBeDefined();
    }
  });

  it("returns the original order when the same idempotency key is replayed", async () => {
    const key = `test-idem-${RUN_ID}`;

    const first = await placeOrder(validOrder({ idempotencyKey: key }), client("idem1"));
    const second = await placeOrder(validOrder({ idempotencyKey: key }), client("idem2"));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    createdOrderIds.push(first.value.id);

    // Same order, not a second cake.
    expect(second.value.id).toBe(first.value.id);
    expect(second.value.publicRef).toBe(first.value.publicRef);

    const count = await db.order.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("charges no delivery fee for collection", async () => {
    const result = await placeOrder(validOrder({ fulfilment: "PICKUP" }), client("pickup"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.value.id);
    expect(result.value.deliveryFeeCents).toBe(0);
  });

  it("writes an outbox event in the same transaction as the order", async () => {
    const result = await placeOrder(validOrder({ idempotencyKey: `test-outbox-${RUN_ID}` }), client("outbox"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.value.id);

    const event = await db.outboxEvent.findFirst({
      // MySQL/MariaDB JSON filters take a JSONPath string, not a key array.
      where: { type: "order.created", payload: { path: "$.orderId", equals: result.value.id } },
    });

    expect(event).not.toBeNull();
    expect(event?.status).toBe("PENDING");
  });

  it("rate limits a client that exceeds its budget", async () => {
    // The limiter's configured limit is small; hammer one key to exhaust it.
    const shared = { clientKey: `test:${RUN_ID}:flood` };
    const attempts = await Promise.all(
      Array.from({ length: 40 }, () => placeOrder(validOrder(), shared)),
    );

    const rejected = attempts.filter((r) => !r.ok && r.error.code === "RATE_LIMITED");
    expect(rejected.length).toBeGreaterThan(0);

    for (const attempt of attempts) {
      if (attempt.ok) createdOrderIds.push(attempt.value.id);
    }
  });
});

describe("priceBasket", () => {
  it("prices a mixed basket without creating an order", async () => {
    const before = await db.order.count();

    const result = await priceBasket(
      [
        { kind: "CAKE", id: cakeId, quantity: 1 },
        { kind: "PRODUCT", id: productId, quantity: 2 },
      ],
      "PICKUP",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.subtotalCents).toBe(85_000 + 15_000);
    expect(result.value.totalCents).toBe(100_000);

    // The whole point: quoting must not have side effects.
    expect(await db.order.count()).toBe(before);
  });

  it("adds the delivery fee only for delivery", async () => {
    const pickup = await priceBasket([{ kind: "CAKE", id: cakeId, quantity: 1 }], "PICKUP");
    const delivery = await priceBasket([{ kind: "CAKE", id: cakeId, quantity: 1 }], "DELIVERY");

    expect(pickup.ok && delivery.ok).toBe(true);
    if (!pickup.ok || !delivery.ok) return;

    expect(pickup.value.deliveryFeeCents).toBe(0);
    expect(delivery.value.deliveryFeeCents).toBe(publicEnv.deliveryFeeCents);
    expect(delivery.value.totalCents).toBe(pickup.value.totalCents + publicEnv.deliveryFeeCents);
  });

  it("rejects an empty basket", async () => {
    const result = await priceBasket([], "PICKUP");
    expect(result.ok).toBe(false);
  });
});

describe("getOrderByRef", () => {
  it("finds an order by its reference, case-insensitively", async () => {
    const placed = await placeOrder(validOrder(), client("lookup"));
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    createdOrderIds.push(placed.value.id);

    const found = await getOrderByRef(placed.value.publicRef.toLowerCase());
    expect(found?.id).toBe(placed.value.id);
  });

  it("returns null for an unknown reference", async () => {
    expect(await getOrderByRef("PBK-ZZZZZZ")).toBeNull();
  });
});
