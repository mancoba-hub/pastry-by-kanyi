import { connection } from "next/server";
import { getOrderByRef } from "@/server/services/order-service";
import { clientKey, orderRateLimiter } from "@/lib/rate-limit";
import { failure } from "@/lib/result";
import { jsonFailure, jsonOk, NO_STORE_HEADERS, handleRoute } from "@/server/http";

/**
 * GET /api/v1/orders/[ref]
 *
 * Public order-status lookup, keyed by the unguessable reference the customer
 * was shown ("PBK-8F2K9A"). There is no customer account, so the reference *is*
 * the credential — which is why this endpoint is rate limited and returns a
 * deliberately thin payload: no address, no phone, no notes.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ ref: string }> },
): Promise<Response> {
  // Rate limiting reads request headers, so this must never be prerendered.
  // Called outside `handleRoute` so its control-flow error is not swallowed.
  await connection();

  return handleRoute("GET /api/v1/orders/[ref]", async () => {
    const limit = orderRateLimiter.check(clientKey(request.headers, "order-lookup"));

    if (!limit.allowed) {
      return jsonFailure(
        failure("RATE_LIMITED", "Too many lookups. Please wait a moment and try again."),
        { ...NO_STORE_HEADERS, "Retry-After": String(limit.retryAfterSeconds ?? 60) },
      );
    }

    const { ref } = await ctx.params;
    const order = await getOrderByRef(ref);

    if (!order) {
      return jsonFailure(
        failure("NOT_FOUND", "We could not find an order with that reference."),
        NO_STORE_HEADERS,
      );
    }

    return jsonOk(
      {
        publicRef: order.publicRef,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfilment: order.fulfilment,
        requestedFor: order.requestedFor,
        createdAt: order.createdAt,
        totalCents: order.totalCents,
        items: order.items.map((item) => ({
          name: item.nameSnapshot,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
        })),
      },
      { headers: NO_STORE_HEADERS },
    );
  });
}
