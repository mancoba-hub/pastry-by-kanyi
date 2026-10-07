import { cacheLife, cacheTag, updateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { CACHE_TAGS, CATALOG_CACHE_LIFE } from "@/server/cache-tags";
import * as products from "@/server/repositories/product-repository";
import type { ProductStatus } from "@/generated/prisma/enums";

/** Product service — the shop side of the business (scones, pastries). */

export async function getShopProducts() {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.products);

  return products.listProducts({ status: "ACTIVE" });
}

export async function getFeaturedProducts(limit = 3) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.products);

  return products.listProducts({ status: "ACTIVE", featuredOnly: true, limit });
}

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.product(slug));

  return products.findProductBySlug(slug);
}

export async function getProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.products);

  const rows = await products.listProducts({ status: "ACTIVE" });
  return rows.map((p) => p.slug);
}

/** Admin reads: the full list including drafts and sold-out items. */
export async function getAdminProducts() {
  return products.listProducts({ status: undefined });
}

export async function getProductForEdit(id: string) {
  return products.findProductById(id);
}

export type ProductMutationInput = {
  name: string;
  description: string;
  priceCents: number;
  unitLabel: string;
  status: ProductStatus;
  isFeatured: boolean;
  stockQty: number | null;
  maxPerOrder: number;
};

function invalidateProductCaches(slug?: string): void {
  updateTag(CACHE_TAGS.products);
  if (slug) updateTag(CACHE_TAGS.product(slug));
}

export async function createProduct(input: ProductMutationInput) {
  const slug = await products.allocateProductSlug(input.name);
  const created = await products.createProduct(input, slug);

  invalidateProductCaches(slug);
  logger.info("product.created", { id: created.id, slug, status: input.status });

  return created;
}

export async function updateProduct(id: string, input: ProductMutationInput) {
  const existing = await products.findProductById(id);
  if (!existing) throw new Error("That product no longer exists.");

  const updated = await products.updateProduct(id, input);

  invalidateProductCaches(existing.slug);
  invalidateProductCaches(updated.slug);
  logger.info("product.updated", { id, slug: updated.slug });

  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await products.findProductById(id);
  if (!existing) throw new Error("That product no longer exists.");

  const { storageKeys } = await products.deleteProduct(id);
  invalidateProductCaches(existing.slug);

  const { storage } = await import("@/server/storage");
  const driver = storage();
  await Promise.all(
    storageKeys.map((key) =>
      driver.delete(key).catch((error: unknown) => logger.warn("product.image.orphaned", { key, error })),
    ),
  );

  logger.info("product.deleted", { id, slug: existing.slug });
}
