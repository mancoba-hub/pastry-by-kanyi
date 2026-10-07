import { getCakeBySlug } from "@/server/services/cake-service";
import { failure } from "@/lib/result";
import { jsonFailure, jsonOk, PUBLIC_CACHE_HEADERS, handleRoute } from "@/server/http";

/** GET /api/v1/cakes/[slug] — a single published bake. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handleRoute("GET /api/v1/cakes/[slug]", async () => {
    const { slug } = await ctx.params;
    const cake = await getCakeBySlug(slug);

    if (!cake) return jsonFailure(failure("NOT_FOUND", "That bake is not in the gallery."));

    return jsonOk(cake, { headers: PUBLIC_CACHE_HEADERS });
  });
}
