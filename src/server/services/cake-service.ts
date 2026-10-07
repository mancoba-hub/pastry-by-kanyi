import { cacheLife, cacheTag, updateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { storage } from "@/server/storage";
import { CACHE_TAGS, CATALOG_CACHE_LIFE } from "@/server/cache-tags";
import * as cakes from "@/server/repositories/cake-repository";
import type { CakeStatus } from "@/generated/prisma/enums";

/**
 * Cake service — the business layer for the bake log.
 *
 * Read functions are cached with `'use cache'`; write functions expire the tags
 * the reads declared. Because the public site is overwhelmingly read traffic,
 * this is the main scaling lever: a gallery pageview costs a CDN hit, not a
 * database query.
 *
 * `'use cache'` is applied per function rather than at file level, so the write
 * paths in this same module stay uncached and can read request state.
 */

export type GalleryQuery = {
  cursor?: string;
  tagSlug?: string;
  occasion?: string;
  limit: number;
};

/** Published bakes, newest first, keyset-paginated. */
export async function getGalleryPage(query: GalleryQuery) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);

  // Tagging by the exact filter combination means an upload only invalidates
  // the views that could actually contain it.
  cacheTag(
    CACHE_TAGS.cakes,
    query.tagSlug ? `${CACHE_TAGS.cakes}:tag:${query.tagSlug}` : `${CACHE_TAGS.cakes}:all`,
  );

  const { decodeCursor, encodeCursor } = await import("@/lib/validation");
  const cursor = decodeCursor(query.cursor);

  const result = await cakes.listCakes({
    limit: query.limit,
    cursor: cursor ? { bakedAt: new Date(cursor.bakedAt), id: cursor.id } : null,
    tagSlug: query.tagSlug,
    occasion: query.occasion,
    status: "PUBLISHED",
    sort: "recent",
  });

  return {
    items: result.items,
    nextCursor: result.nextCursor ? encodeCursor({
      bakedAt: result.nextCursor.bakedAt.toISOString(),
      id: result.nextCursor.id,
    }) : null,
  };
}

export async function getFeaturedCakes(limit = 6) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes);

  const result = await cakes.listCakes({ limit, status: "PUBLISHED", featuredOnly: true });
  return result.items;
}

export async function getMostLovedCakes(limit = 4) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes);

  const result = await cakes.listCakes({ limit, status: "PUBLISHED", sort: "popular" });
  return result.items;
}

export async function getCakeBySlug(slug: string) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes, CACHE_TAGS.cake(slug));

  return cakes.findCakeBySlug(slug);
}

export async function getRelatedCakes(cakeId: string, tagSlugs: string[], take = 4) {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes);

  return cakes.findRelatedCakes({ id: cakeId, tagSlugs, take });
}

export async function getGalleryFacets() {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes, CACHE_TAGS.facets);

  return cakes.listCakeFacets();
}

export async function getPublishedCakeCount() {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes);

  return cakes.countPublishedCakes();
}

/** All published slugs, for `generateStaticParams` and the sitemap. */
export async function getPublishedSlugs(): Promise<{ slug: string; bakedAt: Date }[]> {
  "use cache";
  cacheLife(CATALOG_CACHE_LIFE);
  cacheTag(CACHE_TAGS.cakes);

  const result = await cakes.listCakes({ limit: 1000, status: "PUBLISHED" });
  return result.items.map((c) => ({ slug: c.slug, bakedAt: c.bakedAt }));
}

// ---------------------------------------------------------------------------
// Reads that must never be cached
// ---------------------------------------------------------------------------

export async function getCakeForEdit(id: string) {
  return cakes.findCakeById(id);
}

/**
 * Records a pageview. Deliberately not awaited by callers: a failed increment
 * must not fail the customer's page render.
 */
export async function recordCakeView(cakeId: string): Promise<void> {
  try {
    await cakes.incrementCakeViews(cakeId);
  } catch (error) {
    logger.warn("cake.view.increment.failed", { cakeId, error });
  }
}

export async function likeCakeBySlug(slug: string): Promise<number | null> {
  const cake = await cakes.findCakeBySlug(slug);
  if (!cake) return null;

  return cakes.likeCake(cake.id);
}

// ---------------------------------------------------------------------------
// Writes — these expire the tags the reads above declared
// ---------------------------------------------------------------------------

export type CakeMutationInput = {
  title: string;
  description: string;
  flavour: string | null;
  occasion: string | null;
  servings: number | null;
  priceCents: number | null;
  status: CakeStatus;
  isFeatured: boolean;
  bakedAt: Date;
  tags: string[];
};

/** Expires every cache entry that a cake change could have invalidated. */
function invalidateCakeCaches(slug?: string): void {
  updateTag(CACHE_TAGS.cakes);
  updateTag(CACHE_TAGS.facets);
  updateTag(CACHE_TAGS.adminStats);
  if (slug) updateTag(CACHE_TAGS.cake(slug));
}

export async function createCake(input: CakeMutationInput) {
  const slug = await cakes.allocateSlug(input.title);
  const created = await cakes.createCake(input, slug);

  invalidateCakeCaches(slug);
  logger.info("cake.created", { id: created.id, slug, status: input.status });

  return created;
}

export async function updateCake(id: string, input: CakeMutationInput) {
  const existing = await cakes.findCakeById(id);
  if (!existing) throw new Error("That cake no longer exists.");

  const updated = await cakes.updateCake(id, input);

  // Renaming changes the slug the old cache entries were tagged with, so drop both.
  invalidateCakeCaches(existing.slug);
  invalidateCakeCaches(updated.slug);
  logger.info("cake.updated", { id, slug: updated.slug });

  return updated;
}

export async function publishCake(id: string) {
  const existing = await cakes.findCakeById(id);
  if (!existing) throw new Error("That cake no longer exists.");

  const updated = await cakes.updateCake(id, {
    title: existing.title,
    description: existing.description,
    flavour: existing.flavour,
    occasion: existing.occasion,
    servings: existing.servings,
    priceCents: existing.priceCents,
    status: "PUBLISHED",
    isFeatured: existing.isFeatured,
    bakedAt: existing.bakedAt,
    tags: existing.tags.map((t) => t.label),
  });

  if (!existing.publishedAt) await cakes.markPublished(id);

  invalidateCakeCaches(updated.slug);
  logger.info("cake.published", { id, slug: updated.slug });

  return updated;
}

/** Soft-delete first: archive keeps the URL working and the history intact. */
export async function archiveCake(id: string) {
  const existing = await cakes.findCakeById(id);
  if (!existing) throw new Error("That cake no longer exists.");

  await cakes.updateCake(id, {
    title: existing.title,
    description: existing.description,
    flavour: existing.flavour,
    occasion: existing.occasion,
    servings: existing.servings,
    priceCents: existing.priceCents,
    status: "ARCHIVED",
    isFeatured: false,
    bakedAt: existing.bakedAt,
    tags: existing.tags.map((t) => t.label),
  });

  invalidateCakeCaches(existing.slug);
  logger.info("cake.archived", { id, slug: existing.slug });
}

/**
 * Hard-deletes a cake and its images. A mistake is unrecoverable, which is why
 * the UI routes through `archiveCake` and reserves this for genuine mistakes.
 */
export async function deleteCake(id: string): Promise<void> {
  const existing = await cakes.findCakeById(id);
  if (!existing) throw new Error("That cake no longer exists.");

  const { storageKeys } = await cakes.deleteCake(id);

  invalidateCakeCaches(existing.slug);

  // Object storage is cleaned up after the row is gone: an orphaned object is
  // harmless and cheap, an orphaned row pointing at a deleted object is a
  // broken image on the live site.
  const driver = storage();
  await Promise.all(
    storageKeys.map((key) =>
      driver.delete(key).catch((error: unknown) => logger.warn("cake.image.orphaned", { key, error })),
    ),
  );

  logger.info("cake.deleted", { id, slug: existing.slug, images: storageKeys.length });
}
