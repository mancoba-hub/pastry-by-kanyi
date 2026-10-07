import { getCakeBySlug, recordCakeView } from "@/server/services/cake-service";
import { failure } from "@/lib/result";
import { jsonFailure, jsonOk, NO_STORE_HEADERS, handleRoute } from "@/server/http";
import { clientKey, orderRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/v1/cakes/[slug]/view
 *
 * Records a gallery pageview. Shares the order limiter bucket because both are
 * unauthenticated writes from the public site — one budget for "things an
 * anonymous client can make the server write".
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handleRoute("POST /api/v1/cakes/[slug]/view", async () => {
    const limit = orderRateLimiter.check(clientKey(request.headers, "views"));

    if (!limit.allowed) {
      // Silently accepted: a dropped pageview must not look like an error.
      return jsonOk({ recorded: false }, { headers: NO_STORE_HEADERS });
    }

    const { slug } = await ctx.params;
    const cake = await getCakeBySlug(slug);

    if (!cake) return jsonFailure(failure("NOT_FOUND", "Unknown bake."), NO_STORE_HEADERS);

    await recordCakeView(cake.id);

    return jsonOk({ recorded: true }, { headers: NO_STORE_HEADERS });
  });
}
