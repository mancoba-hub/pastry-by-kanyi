import { db } from "@/lib/db";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";

/** Product data access — scones, pastries and anything else sold by the unit. */

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  priceCents: true,
  unitLabel: true,
  status: true,
  isFeatured: true,
  stockQty: true,
  maxPerOrder: true,
  images: {
    select: { id: true, url: true, alt: true, width: true, height: true, blurDataUrl: true },
    orderBy: [{ isCover: "desc" }, { position: "asc" }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export async function listProducts(args?: {
  status?: ProductStatus;
  featuredOnly?: boolean;
  limit?: number;
}): Promise<ProductCard[]> {
  return db.product.findMany({
    where: {
      status: args?.status ?? "ACTIVE",
      ...(args?.featuredOnly ? { isFeatured: true } : {}),
    },
    select: productCardSelect,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: args?.limit ?? 50,
  });
}

export async function findProductBySlug(slug: string): Promise<ProductCard | null> {
  return db.product.findFirst({ where: { slug, status: { not: "ARCHIVED" } }, select: productCardSelect });
}

export async function findProductById(id: string): Promise<ProductCard | null> {
  return db.product.findUnique({ where: { id }, select: productCardSelect });
}

/** Products referenced by a set of ids, for server-side price resolution. */
export async function findProductsByIds(ids: string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  return db.product.findMany({ where: { id: { in: ids } }, select: productCardSelect });
}

export async function allocateProductSlug(base: string, ignoreId?: string): Promise<string> {
  const { uniqueSlug } = await import("@/lib/slug");
  const root = uniqueSlug(base, () => false);

  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const existing = await db.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === ignoreId) return candidate;
  }

  return `${root}-${Date.now().toString(36)}`;
}

export type UpsertProductInput = {
  name: string;
  description: string;
  priceCents: number;
  unitLabel: string;
  status: ProductStatus;
  isFeatured: boolean;
  stockQty: number | null;
  maxPerOrder: number;
};

export async function createProduct(input: UpsertProductInput, slug: string) {
  return db.product.create({
    data: { ...input, slug },
    select: productCardSelect,
  });
}

export async function updateProduct(id: string, input: UpsertProductInput) {
  return db.product.update({
    where: { id },
    data: input,
    select: productCardSelect,
  });
}

export async function deleteProduct(id: string): Promise<{ storageKeys: string[] }> {
  const images = await db.productImage.findMany({
    where: { productId: id },
    select: { storageKey: true },
  });

  await db.product.delete({ where: { id } });

  return { storageKeys: images.map((i) => i.storageKey) };
}
