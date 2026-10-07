import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * Authorisation guards for the admin area.
 *
 * Two layers, deliberately:
 *   1. `proxy.ts` does a cheap cookie-presence check and redirects early, so an
 *      anonymous visitor never even renders the admin tree.
 *   2. These functions do the real check against the database in the Server
 *      Component or Server Action that needs it.
 *
 * Layer 1 is a UX optimisation, never the security boundary. Every admin page
 * and mutation calls `requireUser()`; if the proxy is misconfigured or bypassed,
 * the data is still protected.
 */

const ROLE_RANK = { VIEWER: 1, ADMIN: 2, OWNER: 3 } as const;

/**
 * Thrown by the `*OrThrow` guards.
 *
 * A distinct type (rather than a plain `Error`) is what lets the route-handler
 * wrapper turn an unauthenticated request into a 401 instead of a 500 — an
 * important distinction for anyone debugging the admin API from the outside.
 */
export class AuthError extends Error {
  constructor(
    readonly kind: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function hasRole(user: SessionUser | null, minimum: SessionUser["role"]): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

/** Redirects to the login page when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** As `requireUser`, but also enforces a minimum role. */
export async function requireRole(minimum: SessionUser["role"]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, minimum)) redirect("/admin?error=insufficient-permissions");
  return user;
}

/**
 * Guard for Server Actions and Route Handlers, which cannot `redirect()` on
 * failure without confusing the caller. Returns the user or throws `AuthError`.
 */
export async function requireUserOrThrow(minimum: SessionUser["role"] = "VIEWER"): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError("UNAUTHORIZED", "Sign in to continue.");
  }

  if (!hasRole(user, minimum)) {
    throw new AuthError("FORBIDDEN", `This action requires the ${minimum} role.`);
  }

  return user;
}
