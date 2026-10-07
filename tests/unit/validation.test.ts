import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, phoneSchema, slugSchema } from "@/lib/validation";

describe("cursor pagination", () => {
  it("round-trips a cursor", () => {
    const cursor = { bakedAt: "2026-01-15T09:30:00.000Z", id: "clx123" };
    const encoded = encodeCursor(cursor);

    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("produces a URL-safe opaque string", () => {
    const encoded = encodeCursor({ bakedAt: "2026-01-15T09:30:00.000Z", id: "clx123" });

    // base64url: no +, / or = padding, so it needs no escaping in a query string.
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null for a missing cursor", () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("returns null instead of throwing on a malformed cursor", () => {
    // A stale or hand-edited bookmark should show page one, not a 500.
    expect(decodeCursor("not-base64!!")).toBeNull();
    expect(decodeCursor(Buffer.from("{}").toString("base64url"))).toBeNull();
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ bakedAt: "not-a-date", id: "x" })).toString("base64url")),
    ).toBeNull();
  });
});

describe("shared field schemas", () => {
  it("rejects slugs with uppercase, spaces or leading hyphens", () => {
    expect(slugSchema.safeParse("Chocolate Drip").success).toBe(false);
    expect(slugSchema.safeParse("-chocolate").success).toBe(false);
    expect(slugSchema.safeParse("chocolate--drip").success).toBe(false);
    expect(slugSchema.safeParse("chocolate-drip-2").success).toBe(true);
  });

  it("normalises a South African phone number to E.164", () => {
    const parsed = phoneSchema.safeParse("082 123 4567");

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("+27821234567");
  });

  it("reports a friendly message for input that is too short", () => {
    const parsed = phoneSchema.safeParse("12345");

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("Enter a phone number.");
    }
  });

  it("explains the expected format for a long but invalid number", () => {
    // Long enough to pass the length guard, so the transform's own message is
    // what surfaces — here a Cape Town landline, which cannot receive WhatsApp.
    const parsed = phoneSchema.safeParse("021 123 4567");

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("South African");
    }
  });
});
