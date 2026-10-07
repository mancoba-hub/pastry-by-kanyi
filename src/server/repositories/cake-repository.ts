import { db } from "@/lib/db";
import { uniqueSlug, tagSlug } from "@/lib/slug";
import type { CakeStatus, Prisma } from "@/generated/prisma/client";

/**
 * Cake data access.
 *
 * Repositories own Prisma queries and nothing else: no business rules, no cache
 * tags, no error translation. That makes them trivially testable and lets the
 * service layer change policy without touching SQL shape.
 */

/**
 * Columns the public site needs for grid and detail views. Choosing fields
 * explicitly (rather than returning whole rows) keeps the payload small and
 * makes an accidental `SELECT *`-style leak of internal columns impossible.
 */
export const cakeCardSelect = {
  id: true,
  slug: true,
  title: true,
  flavour: true,
  occasion: true,
  servings: true,
  priceCents: true,
  isFeatured: true,
  bakedAt: true,
  viewCount: true,
  tags: { select: { label: true, slug: true } },
  images: {
    select: { id: true, url: true, alt: true, width: true, height: true, blurDataUrl: true, isCover: true },
    orderBy: [{ isCover: "desc" }, { position: "asc" }],
    take: 1,
  },
} satisfies Prisma.CakeSelect;

export const cakeDetailSelect = {
  ...cakeCardSelect,
  description: true,
  status: true,
  publishedAt: true,
  likeCount: true,
  images: {
    select: { id: true, url: true, alt: true, width: true, height: true, blurDataUrl: true, position: true },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.CakeSelect;

export type CakeCard = Prisma.CakeGetPayload<{ select: typeof cakeCardSelect }>;
export type CakeDetail = Prisma.CakeGetPayload<{ select: typeof cakeDetailSelect }>;

export type CakeCursor = { bakedAt: Date; id: string };

export type ListCakesArgs = {
  limit: number;
  cursor?: CakeCursor | null;
  status?: CakeStatus;
  tagSlug?: string;
  occasion?: string;
  featuredOnly?: boolean;
  /** Popularity ordering is a separate index (viewCount) from recency. */
  sort?: "recent" | "popular";
};

export type ListedCakes = {
  items: CakeCard[];
  nextCursor: CakeCursor | null;
};

/**
 * Keyset-paginated cake listing.
 *
 * Fetches `limit + 1` rows to determine whether a further page exists without a
 * second `COUNT(*)` query. Ordering is always `(bakedAt, id)`: the tiebreaker is
 * what makes the cursor total, so simultaneous uploads cannot be skipped.
 */
export async function listCakes(args: ListCakesArgs): Promise<ListedCakes> {
  const { limit, cursor, status = "PUBLISHED", tagSlug: tag, occasion, featuredOnly, sort = "recent" } = args;

  const where: Prisma.CakeWhereInput = {
    status,
    ...(occasion ? { occasion } : {}),
    ...(featuredOnly ? { isFeatured: true } : {}),
    ...(tag ? { tags: { some: { slug: tag } } } : {}),
    ...(sort === "recent" && cursor
      ? {
          OR: [
            { bakedAt: { lt: cursor.bakedAt } },
            { bakedAt: cursor.bakedAt, id: { lt: cursor.id } },
          ],
        }
      : {}),
  };

  const rows = await db.cake.findMany({
    where,
    select: cakeCardSelect,
    orderBy:
      sort === "popular"
        ? [{ viewCount: "desc" }, { id: "desc" }]
        : [{ bakedAt: "desc" }, { id: "desc" }],
    // Popular ordering is not keyset-stable here; it is only used for the
    // "most loved" rail, which is small and unpaginated.
    take: sort === "popular" ? limit : limit + 1,
  });

  const hasMore = sort === "recent" && rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? { bakedAt: last.bakedAt, id: last.id } : null,
  };
}

export async function findCakeBySlug(slug: string): Promise<CakeDetail | null> {
  return db.cake.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: cakeDetailSelect,
  });
}

export async function findCakeById(id: string): Promise<CakeDetail | null> {
  return db.cake.findUnique({ where: { id }, select: cakeDetailSelect });
}

/** Related bakes, preferring shared tags before falling back to recency. */
export async function findRelatedCakes(cake: {
  id: string;
  tagSlugs: string[];
  take?: number;
}): Promise<CakeCard[]> {
  const take = cake.take ?? 4;

  const byTag =
    cake.tagSlugs.length > 0
      ? await db.cake.findMany({
          where: {
            status: "PUBLISHED",
            id: { not: cake.id },
            tags: { some: { slug: { in: cake.tagSlugs } } },
          },
          select: cakeCardSelect,
          orderBy: [{ bakedAt: "desc" }, { id: "desc" }],
          take,
        })
      : [];

  if (byTag.length >= take) return byTag;

  const seen = new Set([cake.id, ...byTag.map((c) => c.id)]);
  const filler = await db.cake.findMany({
    where: { status: "PUBLISHED", id: { notIn: [...seen] } },
    select: cakeCardSelect,
    orderBy: [{ isFeatured: "desc" }, { bakedAt: "desc" }],
    take: take - byTag.length,
  });

  return [...byTag, ...filler];
}

/** Distinct facet values for the gallery filter bar. */
export async function listCakeFacets(): Promise<{
  tags: { label: string; slug: string; count: number }[];
  occasions: { label: string; count: number }[];
}> {
  // Ordered in JS rather than via `orderBy` on a grouped count: the result sets
  // are capped, and it keeps the query portable across Prisma versions.
  // `take` requires an `orderBy` on a grouped field.
  const [tags, occasions] = await Promise.all([
    db.cakeTag.groupBy({
      by: ["label", "slug"],
      where: { cake: { status: "PUBLISHED" } },
      _count: { _all: true },
      orderBy: { label: "asc" },
      take: 50,
    }),
    db.cake.groupBy({
      by: ["occasion"],
      where: { status: "PUBLISHED", occasion: { not: null } },
      _count: { _all: true },
      orderBy: { occasion: "asc" },
      take: 30,
    }),
  ]);

  return {
    tags: tags
      .map((t) => ({ label: t.label, slug: t.slug, count: t._count._all }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 20),
    occasions: occasions
      .filter((o): o is typeof o & { occasion: string } => o.occasion !== null)
      .map((o) => ({ label: o.occasion, count: o._count._all }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 12),
  };
}

export async function countPublishedCakes(): Promise<number> {
  return db.cake.count({ where: { status: "PUBLISHED" } });
}

export type UpsertCakeInput = {
  title: string;
  description: string;
  flavour?: string | null;
  occasion?: string | null;
  servings?: number | null;
  priceCents?: number | null;
  status: CakeStatus;
  isFeatured: boolean;
  bakedAt: Date;
  tags: string[];
};

/**
 * Resolves a collision-free slug for a cake title.
 *
 * Probes the base slug first and only walks the `-2`, `-3` … suffixes on a hit,
 * so the common case is a single indexed lookup. A unique constraint on
 * `Cake.slug` remains the real guarantee; this just avoids the collision.
 */
export async function allocateSlug(title: string, ignoreId?: string): Promise<string> {
  const root = uniqueSlug(title, () => false); // slugify + fallback to "untitled"

  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const existing = await db.cake.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === ignoreId) return candidate;
  }

  return `${root}-${Date.now().toString(36)}`;
}

export async function createCake(input: UpsertCakeInput, slug: string) {
  return db.cake.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      flavour: input.flavour,
      occasion: input.occasion,
      servings: input.servings,
      priceCents: input.priceCents,
      status: input.status,
      isFeatured: input.isFeatured,
      bakedAt: input.bakedAt,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      tags: {
        create: input.tags.map((label) => ({ label, slug: tagSlug(label) })),
      },
    },
    select: cakeDetailSelect,
  });
}

export async function updateCake(id: string, input: UpsertCakeInput) {
  return db.$transaction(async (tx) => {
    await tx.cakeTag.deleteMany({ where: { cakeId: id } });

    return tx.cake.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        flavour: input.flavour,
        occasion: input.occasion,
        servings: input.servings,
        priceCents: input.priceCents,
        status: input.status,
        isFeatured: input.isFeatured,
        bakedAt: input.bakedAt,
        tags: { create: input.tags.map((label) => ({ label, slug: tagSlug(label) })) },
      },
      select: cakeDetailSelect,
    });
  });
}

/** Publishes a draft the first time, preserving the original publish date after. */
export async function markPublished(id: string): Promise<void> {
  await db.cake.updateMany({
    where: { id, publishedAt: null },
    data: { publishedAt: new Date() },
  });
}

export async function deleteCake(id: string): Promise<{ storageKeys: string[] }> {
  const images = await db.cakeImage.findMany({ where: { cakeId: id }, select: { storageKey: true } });
  await db.cake.delete({ where: { id } });

  return { storageKeys: images.map((i) => i.storageKey) };
}

/**
 * Increments the view counter without returning the row.
 *
 * Fire-and-forget by design: a lost increment is not worth failing a pageview,
 * and the counter only feeds a "popular" rail.
 */
export async function incrementCakeViews(id: string): Promise<void> {
  await db.cake.update({ where: { id }, data: { viewCount: { increment: 1 } } });
}

export async function likeCake(id: string): Promise<number> {
  const updated = await db.cake.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
    select: { likeCount: true },
  });

  return updated.likeCount;
}

/**
 * Minimal cake projection for order pricing.
 * Prices are read here, server-side, so a tampered client payload cannot set
 * the amount a customer pays.
 */
export async function findCakesForOrder(ids: string[]) {
  if (ids.length === 0) return [];

  return db.cake.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      priceCents: true,
      images: {
        select: { url: true, alt: true },
        orderBy: [{ isCover: "desc" }, { position: "asc" }],
        take: 1,
      },
    },
  });
}
