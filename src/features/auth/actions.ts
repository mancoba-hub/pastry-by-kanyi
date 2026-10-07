"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loginRateLimiter, clientKey } from "@/lib/rate-limit";
import { verifyPassword, needsRehash, hashPassword } from "@/server/auth/password";
import { createSession, destroyCurrentSession } from "@/server/auth/session";
import { loginSchema, safeRedirectTarget, type LoginState } from "./schema";

/**
 * Authentication actions.
 *
 * Security notes:
 *   - The failure message never distinguishes "no such account" from "wrong
 *     password", so the form cannot be used to enumerate staff emails.
 *   - A password that verifies is transparently re-hashed if the stored cost
 *     parameters are below current, so raising them later is a non-event.
 *   - Rate limited per IP to blunt credential stuffing against a two-account
 *     admin panel where the search space is small.
 */

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const headerList = await headers();
  const limit = loginRateLimiter.check(clientKey(headerList, "login"));

  if (!limit.allowed) {
    return {
      message: `Too many attempts. Try again in ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minute(s).`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { message: "Check the details you entered.", fields: fieldErrors(parsed.error.issues) };
  }

  const { email, password, next } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
  });

  // Always run a verification, even for an unknown account, so response time
  // does not reveal whether the email exists.
  const storedHash = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, storedHash);

  if (!user || !valid || !user.isActive) {
    logger.warn("auth.login.failed", { email });
    return { message: "Those details don't match an account." };
  }

  if (needsRehash(user.passwordHash)) {
    const upgraded = await hashPassword(password);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
    logger.info("auth.password.rehashed", { userId: user.id });
  }

  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  logger.info("auth.login.success", { userId: user.id, role: user.role });

  // redirect() throws a control-flow signal and must not be inside a try/catch.
  redirect(safeRedirectTarget(next));
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/admin/login");
}

/**
 * A valid-looking scrypt hash used when the account does not exist, so the
 * failed-login path costs the same as the real one.
 */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

function fieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}
