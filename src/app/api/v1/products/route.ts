import { getShopProducts } from "@/server/services/product-service";
import { jsonOk, PUBLIC_CACHE_HEADERS, handleRoute } from "@/server/http";

/** GET /api/v1/products — everything currently on sale in the shop. */
export async function GET(): Promise<Response> {
  return handleRoute("GET /api/v1/products", async () => {
    const products = await getShopProducts();

    return jsonOk(products, {
      headers: PUBLIC_CACHE_HEADERS,
      meta: { count: products.length },
    });
  });
}
