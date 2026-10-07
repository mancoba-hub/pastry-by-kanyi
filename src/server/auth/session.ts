import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/ids";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Session management.
 *
 * The cookie holds a 256-bit random token. Only its SHA-256 digest is stored, so
 * reading the database does not yield usable credentials, and sessions can be
 * revoked server-side (which a stateless JWT cannot do without extra machinery).
 *
 * Scale note: this adds one indexed primary-key lookup per authenticated
 * request. Admin traffic is negligible, so that is the right trade. If session
 * reads ever show up in a profile, cache the `{ tokenHash -> session }` mapping
 * in Redis with a short TTL and keep the database as the source of truth.
 */

export const SESSION_COOKIE = "pbk_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type CreatedSession = {
  token: string;
  expiresAt: Date;
};

async function requestMetadata(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return {
      ip: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
      userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    };
  } catch {
    // Outside a request scope (scripts, seeds).
    return { ip: null, userAgent: null };
  }
}

/** Creates a session row and writes the cookie. */
export async function createSession(userId: string, ttlDays = SESSION_TTL_DAYS): Promise<CreatedSession> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const meta = await requestMetadata();

  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Resolves the current session. Returns null when absent, expired or revoked.
 * Also slides the expiry forward when the session is more than a day old, so an
 * active baker is not logged out mid-use.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: { id: true, email: true, name: true, role: true, isActive: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (!session.user.isActive) return null;

  const oneDayMs = 24 * 60 * 60 * 1000;
  if (session.expiresAt.getTime() - Date.now() < (SESSION_TTL_DAYS - 1) * oneDayMs) {
    void db.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * oneDayMs) },
      })
      .catch((error: unknown) => logger.warn("session.slide.failed", { error }));
  }

  return session.user;
}

/** Revokes the current session and clears the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session
      .updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } })
      .catch((error: unknown) => logger.warn("session.revoke.failed", { error }));
  }

  store.delete(SESSION_COOKIE);
}

/** Revokes every session for a user — the "sign out everywhere" action. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count;
}

/**
 * Physically removes expired/revoked rows. Called opportunistically rather than
 * on a schedule, which is enough at this scale and avoids needing a cron.
 */
export async function pruneSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: { OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
  });

  return result.count;
}
