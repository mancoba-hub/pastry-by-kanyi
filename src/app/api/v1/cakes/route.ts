import { connection } from "next/server";
import {
  getGalleryPage,
  getPublishedCakeCount,
} from "@/server/services/cake-service";
import { failure } from "@/lib/result";
import { jsonFailure, jsonOk, PUBLIC_CACHE_HEADERS, handleRoute } from "@/server/http";
import { GALLERY_PAGE_SIZE } from "@/server/cache-tags";

/**
 * GET /api/v1/cakes
 *
 * Public, cacheable gallery feed. Cursor-paginated so the client can append
 * indefinitely without the offset-pagination drift that shows duplicate or
 * skipped cakes while the baker is uploading.
 *
 * Query: ?limit=12&cursor=<opaque>&tag=<slug>&occasion=<name>
 *
 * `connection()` is awaited *before* entering `handleRoute`, deliberately.
 * During prerendering it signals "this needs a real request" by throwing a
 * control-flow error that React expects to handle; a surrounding try/catch would
 * swallow it and silently produce a bogus static response.
 */
export async function GET(request: Request): Promise<Response> {
  await connection();

  return handleRoute("GET /api/v1/cakes", async () => {
    const url = new URL(request.url);
    const params = url.searchParams;

    const rawLimit = Number.parseInt(params.get("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), GALLERY_PAGE_SIZE * 2)
      : GALLERY_PAGE_SIZE;

    const page = await getGalleryPage({
      limit,
      cursor: params.get("cursor") ?? undefined,
      tagSlug: params.get("tag") ?? undefined,
      occasion: params.get("occasion") ?? undefined,
    });

    // A cursor that resolved to nothing means the caller walked off the end.
    if (page.items.length === 0 && params.get("cursor")) {
      return jsonFailure(failure("NOT_FOUND", "No more bakes to load."));
    }

    return jsonOk(page.items, {
      headers: PUBLIC_CACHE_HEADERS,
      meta: { nextCursor: page.nextCursor, count: page.items.length },
    });
  });
}

/** HEAD is used by uptime checks and link previewers; keep it cheap. */
export async function HEAD(): Promise<Response> {
  const total = await getPublishedCakeCount();

  return new Response(null, {
    status: 200,
    headers: { ...PUBLIC_CACHE_HEADERS, "X-Total-Bakes": String(total) },
  });
}
