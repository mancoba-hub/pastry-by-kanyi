/**
 * Rate limiting.
 *
 * Public write endpoints (order creation) are the only unauthenticated writes on
 * the site, so they are the abuse surface. The default limiter is an in-process
 * sliding window — correct for a single instance and for local development.
 *
 * Scale note: with more than one instance the counter must be shared. Set
 * REDIS_URL and swap `createRateLimiter()` for a Redis-backed implementation
 * (INCR + EXPIRE). The interface below is deliberately narrow so that swap is
 * a one-line change at the call site.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the caller may retry. Only set when `allowed` is false. */
  retryAfterSeconds?: number;
};

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

type Bucket = { count: number; resetAt: number };

export function createInMemoryRateLimiter(opts: {
  limit: number;
  windowMs: number;
  /** Cap on tracked keys, to bound memory under a flood of unique clients. */
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs, maxKeys = 10_000 } = opts;
  const buckets = new Map<string, Bucket>();

  const evictExpired = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const existing = buckets.get(key);

      if (existing && existing.resetAt > now) {
        if (existing.count >= limit) {
          return {
            allowed: false,
            remaining: 0,
            limit,
            retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
          };
        }

        existing.count += 1;
        return { allowed: true, remaining: limit - existing.count, limit };
      }

      if (buckets.size >= maxKeys) evictExpired(now);
      // Still saturated after eviction: fail closed rather than grow unbounded.
      if (buckets.size >= maxKeys) {
        return { allowed: false, remaining: 0, limit, retryAfterSeconds: 60 };
      }

      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, limit };
    },
  };
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Limiter for order submission, keyed per client IP.
 * Limit is configurable so the baker can raise it on a busy day.
 */
export const orderRateLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: Number.parseInt(process.env.ORDER_RATE_LIMIT_PER_HOUR ?? "10", 10) || 10,
  windowMs: HOUR_MS,
});

/** Tighter limiter for login, to blunt credential stuffing. */
export const loginRateLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 8,
  windowMs: 15 * 60 * 1000,
  maxKeys: 5_000,
});

/**
 * Best-effort client identity. Behind a proxy (Vercel/Cloudflare) the left-most
 * `x-forwarded-for` entry is the client. Falls back to a constant, which makes
 * the limiter global rather than per-client — safe, but blunt.
 */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";

  return `${scope}:${ip}`;
}
