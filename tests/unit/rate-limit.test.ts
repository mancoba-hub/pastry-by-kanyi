import { describe, expect, it, vi } from "vitest";
import { createInMemoryRateLimiter, clientKey } from "@/lib/rate-limit";

/**
 * The rate limiter is what stands between an unauthenticated write endpoint and
 * a script. These tests pin the behaviour that matters: it limits, it recovers
 * after the window, and it fails closed rather than growing without bound.
 */
describe("rate limiter", () => {
  it("allows up to the limit and then blocks", () => {
    const limiter = createInMemoryRateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);

    const blocked = limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    // A different client is unaffected.
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("reports the remaining allowance", () => {
    const limiter = createInMemoryRateLimiter({ limit: 5, windowMs: 60_000 });

    expect(limiter.check("ip").remaining).toBe(4);
    expect(limiter.check("ip").remaining).toBe(3);
  });

  it("recovers once the window elapses", () => {
    vi.useFakeTimers();
    try {
      const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1_000 });

      expect(limiter.check("ip").allowed).toBe(true);
      expect(limiter.check("ip").allowed).toBe(false);

      vi.advanceTimersByTime(1_001);
      expect(limiter.check("ip").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed instead of growing without bound", () => {
    // maxKeys is the memory guard: once it is full, unknown clients are refused
    // rather than being allowed to allocate indefinitely.
    const limiter = createInMemoryRateLimiter({ limit: 10, windowMs: 60_000, maxKeys: 4 });

    for (let i = 0; i < 4; i += 1) {
      expect(limiter.check(`client-${i}`).allowed).toBe(true);
    }

    expect(limiter.check("client-overflow").allowed).toBe(false);
  });
});

describe("clientKey", () => {
  it("uses the left-most forwarded address", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

    expect(clientKey(headers, "orders")).toBe("orders:203.0.113.7");
  });

  it("falls back to other proxy headers", () => {
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.4" }), "login")).toBe("login:198.51.100.4");
    expect(clientKey(new Headers({ "cf-connecting-ip": "198.51.100.9" }), "login")).toBe(
      "login:198.51.100.9",
    );
  });

  it("uses a shared bucket when no client address is available", () => {
    // Blunt but safe: an unknown client shares one budget with all other
    // unknown clients rather than bypassing the limiter.
    expect(clientKey(new Headers(), "orders")).toBe("orders:unknown");
  });

  it("namespaces by scope so limits do not bleed between endpoints", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });

    expect(clientKey(headers, "orders")).not.toBe(clientKey(headers, "views"));
  });
});
