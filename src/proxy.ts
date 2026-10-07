import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` to `proxy`. It runs on the Node.js runtime
 * (the edge runtime is no longer supported here).
 *
 * SECURITY NOTE — this is an *optimistic* check only. It looks at whether a
 * session cookie is present; it does not validate it, because proxy runs on
 * every matched request and a database round trip here would tax the whole app.
 *
 * The real authorisation boundary is `requireUser()` / `requireRole()` in
 * src/server/auth/guard.ts, called by every admin page, Server Action and Route
 * Handler. If this file were deleted entirely, the admin area would still be
 * protected — visitors would just see a redirect instead of the login page.
 */

const SESSION_COOKIE = "pbk_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminArea = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  if (!isAdminArea || isLoginPage) return NextResponse.next();

  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasCookie) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  // Preserve where the user was heading so login can return them there.
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
