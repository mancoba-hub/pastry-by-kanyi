import { createInMemoryRateLimiter, type RateLimitResult } from "@/lib/rate-limit";

/**
 * Per-user rate limits for admin actions.
 *
 * Keyed by user id rather than IP: the admin panel is authenticated, so the
 * meaningful unit is "how much is this account doing", and a baker on mobile
 * data changing IP mid-session should not be treated as a new actor.
 *
 * Limits are generous — this exists to stop a runaway script or a stuck retry
 * loop, not to police a human.
 */

const limiters = new Map<string, ReturnType<typeof createInMemoryRateLimiter>>();

const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  presign: { limit: 120, windowMs: 60 * 60 * 1000 },
  upload: { limit: 120, windowMs: 60 * 60 * 1000 },
  mutation: { limit: 300, windowMs: 60 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
};

function limiterFor(scope: string) {
  const existing = limiters.get(scope);
  if (existing) return existing;

  const config = LIMITS[scope] ?? { limit: 120, windowMs: 60 * 60 * 1000 };
  const created = createInMemoryRateLimiter({ ...config, maxKeys: 5_000 });

  limiters.set(scope, created);
  return created;
}

export function checkAdminRateLimit(
  userId: string,
  scope: keyof typeof LIMITS | string,
  /** Overrides the scope's default limit when provided. */
  limit?: number,
  windowMs?: number,
): RateLimitResult {
  // An explicit limit/window gets its own bucket, so a caller-specific rule
  // cannot accidentally loosen the shared one.
  if (limit !== undefined && windowMs !== undefined) {
    const key = `${scope}:${limit}:${windowMs}`;
    const existing = limiters.get(key);
    const limiter = existing ?? createInMemoryRateLimiter({ limit, windowMs, maxKeys: 5_000 });

    if (!existing) limiters.set(key, limiter);

    return limiter.check(userId);
  }

  return limiterFor(scope).check(userId);
}
