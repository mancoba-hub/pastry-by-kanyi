import { failure, type Err, type Failure } from "@/lib/result";
import { AuthError } from "@/server/auth/guard";
import { logger } from "@/lib/logger";

/**
 * HTTP helpers.
 *
 * Every API response uses the same envelope so clients can parse uniformly:
 *   success: { data: T, meta?: {...} }
 *   failure: { error: { code, message, fields? } }
 *
 * Status codes are derived from the domain `FailureCode` in one place, so a new
 * endpoint cannot accidentally return 200 for a rejected order.
 */

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
export type ApiFailure = { error: { code: string; message: string; fields?: Record<string, string[]> } };

const STATUS_BY_CODE: Record<Failure["code"], number> = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export function jsonOk<T>(
  data: T,
  init?: { status?: number; headers?: Record<string, string>; meta?: Record<string, unknown> },
): Response {
  const body: ApiSuccess<T> = { data, ...(init?.meta ? { meta: init.meta } : {}) };

  return Response.json(body, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

/**
 * Accepts either a bare `Failure` or the `Err<Failure>` that `failure()`
 * returns, so call sites can pass whichever they already hold.
 */
export function jsonFailure(input: Err<Failure> | Failure, extraHeaders?: Record<string, string>): Response {
  const failure: Failure = "ok" in input ? input.error : input;
  const status = STATUS_BY_CODE[failure.code] ?? 500;

  return Response.json(
    {
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.fields ? { fields: failure.fields } : {}),
      },
    } satisfies ApiFailure,
    { status, headers: extraHeaders },
  );
}

/**
 * Wraps a handler so an unexpected throw becomes a clean 500 and a logged error,
 * rather than leaking a stack trace to the client.
 *
 * `AuthError` is handled separately: an unauthenticated admin request is an
 * ordinary 401, not a server fault, and logging it at error level would drown
 * the real errors.
 */
export async function handleRoute(
  routeName: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AuthError) {
      logger.warn("api.auth_rejected", { route: routeName, kind: error.kind });

      return jsonFailure(
        failure(error.kind, error.message),
        error.kind === "UNAUTHORIZED" ? { "WWW-Authenticate": 'Cookie realm="admin"' } : undefined,
      );
    }

    logger.error("api.unhandled_error", { route: routeName, error });

    return Response.json(
      { error: { code: "INTERNAL", message: "Something went wrong on our side." } } satisfies ApiFailure,
      { status: 500 },
    );
  }
}

/**
 * Cache-Control for public, non-personalised catalog reads.
 *
 * `s-maxage` lets a CDN absorb essentially all gallery traffic; `swr` keeps
 * responses fast while a fresh copy is computed in the background.
 */
export const PUBLIC_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

export const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, must-revalidate",
};
