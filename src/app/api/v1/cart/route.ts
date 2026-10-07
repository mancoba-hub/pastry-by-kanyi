import { priceBasket } from "@/server/services/order-service";
import { failure } from "@/lib/result";
import { jsonFailure, jsonOk, NO_STORE_HEADERS, handleRoute } from "@/server/http";

/**
 * POST /api/v1/cart
 *
 * Prices a basket. The basket itself lives in the browser (there is no customer
 * account), so this is how the cart page and the checkout summary learn the
 * current names, availability and prices.
 *
 * Personalised and short-lived, so it must never be cached by a CDN.
 *
 * Body: { items: [{ kind: "CAKE" | "PRODUCT", id: string, quantity: number }], fulfilment?: "PICKUP" | "DELIVERY" }
 */
export async function POST(request: Request): Promise<Response> {
  return handleRoute("POST /api/v1/cart", async () => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonFailure(failure("VALIDATION", "Expected a JSON body."), NO_STORE_HEADERS);
    }

    const payload = body as { items?: unknown; fulfilment?: unknown } | null;

    const fulfilment = payload?.fulfilment === "DELIVERY" ? "DELIVERY" : "PICKUP";

    const result = await priceBasket(payload?.items, fulfilment);

    if (!result.ok) return jsonFailure(result.error, NO_STORE_HEADERS);

    return jsonOk(result.value, { headers: NO_STORE_HEADERS });
  });
}
