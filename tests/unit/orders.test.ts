import { describe, expect, it } from "vitest";
import {
  checkoutSchema,
  earliestRequestedDate,
  LEAD_TIME_HOURS,
  MAX_LINE_QUANTITY,
} from "@/features/orders/schema";
import { generateOrderRef, randomToken, sha256 } from "@/lib/ids";
import { basketIdempotencyKey } from "@/features/cart/idempotency";

describe("checkoutSchema", () => {
  const base = {
    customerName: "Thandi Mokoena",
    customerPhone: "082 123 4567",
    fulfilment: "PICKUP" as const,
    items: [{ kind: "PRODUCT" as const, id: "prod_1", quantity: 2 }],
  };

  it("accepts a minimal valid order", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });

  it("normalises the phone number as part of parsing", () => {
    const parsed = checkoutSchema.safeParse(base);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.customerPhone).toBe("+27821234567");
  });

  it("requires a delivery address for delivery orders", () => {
    const parsed = checkoutSchema.safeParse({ ...base, fulfilment: "DELIVERY" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].path).toContain("deliveryAddress");
    }
  });

  it("accepts a delivery order once an address is given", () => {
    const parsed = checkoutSchema.safeParse({
      ...base,
      fulfilment: "DELIVERY",
      deliveryAddress: "Kilimani, Wood Avenue",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an empty basket", () => {
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("caps quantity per line", () => {
    const tooMany = {
      ...base,
      items: [{ kind: "PRODUCT" as const, id: "p", quantity: MAX_LINE_QUANTITY + 1 }],
    };

    expect(checkoutSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects a zero or fractional quantity", () => {
    expect(
      checkoutSchema.safeParse({ ...base, items: [{ kind: "PRODUCT", id: "p", quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, items: [{ kind: "PRODUCT", id: "p", quantity: 1.5 }] }).success,
    ).toBe(false);
  });

  it("ignores any price the client tries to send", () => {
    // Prices are not part of the schema at all — they are resolved server-side.
    const parsed = checkoutSchema.safeParse({
      ...base,
      items: [{ kind: "PRODUCT", id: "p", quantity: 1, unitPriceCents: 1, lineTotalCents: 1 }],
      totalCents: 1,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0]).not.toHaveProperty("unitPriceCents");
      expect(parsed.data).not.toHaveProperty("totalCents");
    }
  });
});

describe("lead time", () => {
  it("is 48 hours", () => {
    expect(LEAD_TIME_HOURS).toBe(48);
  });

  it("returns a date the configured lead time ahead", () => {
    const now = new Date("2026-03-01T10:00:00.000Z");
    const earliest = earliestRequestedDate(now);

    expect(earliest.getTime() - now.getTime()).toBe(LEAD_TIME_HOURS * 60 * 60 * 1000);
  });
});

describe("order references", () => {
  it("has the documented shape", () => {
    expect(generateOrderRef()).toMatch(/^PBK-[A-Z2-9]{6}$/);
  });

  it("avoids characters that get misread when typed by hand", () => {
    // No O/0 or I/1 in the alphabet.
    const refs = Array.from({ length: 200 }, () => generateOrderRef());

    for (const ref of refs) {
      expect(ref).not.toMatch(/[O0I1]/);
    }
  });

  it("does not repeat across many calls", () => {
    const refs = new Set(Array.from({ length: 2_000 }, () => generateOrderRef()));
    expect(refs.size).toBe(2_000);
  });
});

describe("tokens", () => {
  it("produces URL-safe high-entropy values", () => {
    const token = randomToken(32);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(new Set(Array.from({ length: 100 }, () => randomToken(32))).size).toBe(100);
  });

  it("hashes deterministically so a session token can be looked up", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
    expect(sha256("abc")).toHaveLength(64);
  });
});

describe("basketIdempotencyKey", () => {
  it("is stable regardless of line order", () => {
    const a = basketIdempotencyKey([
      { kind: "CAKE", id: "a", quantity: 1 },
      { kind: "PRODUCT", id: "b", quantity: 2 },
    ]);
    const b = basketIdempotencyKey([
      { kind: "PRODUCT", id: "b", quantity: 2 },
      { kind: "CAKE", id: "a", quantity: 1 },
    ]);

    // Same basket, same key — so a retry returns the original order.
    expect(a).toBe(b);
  });

  it("changes when the basket changes", () => {
    const a = basketIdempotencyKey([{ kind: "CAKE", id: "a", quantity: 1 }]);
    const b = basketIdempotencyKey([{ kind: "CAKE", id: "a", quantity: 2 }]);
    const c = basketIdempotencyKey([{ kind: "CAKE", id: "b", quantity: 1 }]);

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("distinguishes a cake from a product with the same id", () => {
    expect(basketIdempotencyKey([{ kind: "CAKE", id: "x", quantity: 1 }])).not.toBe(
      basketIdempotencyKey([{ kind: "PRODUCT", id: "x", quantity: 1 }]),
    );
  });
});
