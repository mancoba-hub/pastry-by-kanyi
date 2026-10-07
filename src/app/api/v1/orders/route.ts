import { placeOrder } from "@/server/services/order-service";
import { clientKey } from "@/lib/rate-limit";
import { failure } from "@/lib/result";
import { jsonFailure, jsonOk, NO_STORE_HEADERS, handleRoute } from "@/server/http";
import { publicEnv } from "@/lib/env";
import { orderMessage, whatsappLink } from "@/lib/whatsapp";

/**
 * POST /api/v1/orders
 *
 * Creates an order. This is the only unauthenticated write on the site, so it is
 * rate limited per client, fully validated, and priced server-side.
 *
 * The response includes a pre-built WhatsApp deep link so the customer can hand
 * the order straight to the baker — the step that actually converts for a
 * WhatsApp-first business.
 */
export async function POST(request: Request): Promise<Response> {
  return handleRoute("POST /api/v1/orders", async () => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonFailure(failure("VALIDATION", "Expected a JSON body."));
    }

    const result = await placeOrder(body, {
      clientKey: clientKey(request.headers, "orders"),
      channel: "WEB",
    });

    if (!result.ok) {
      return jsonFailure(
        result.error,
        // Never let a CDN or proxy cache a rejected write.
        NO_STORE_HEADERS,
      );
    }

    const order = result.value;

    return jsonOk(
      {
        publicRef: order.publicRef,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        fulfilment: order.fulfilment,
        subtotalCents: order.subtotalCents,
        deliveryFeeCents: order.deliveryFeeCents,
        totalCents: order.totalCents,
        requestedFor: order.requestedFor,
        items: order.items,
        /** Deep link that sends the order summary to the baker's WhatsApp. */
        whatsappUrl: whatsappLink(orderMessage(order), publicEnv.whatsappNumber),
      },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  });
}

/** Order creation is a POST-only endpoint. */
export async function GET(): Promise<Response> {
  return jsonFailure(failure("VALIDATION", "Use POST to create an order."));
}
