/**
 * Cache tags — the contract between readers and writers.
 *
 * Every cached read declares the tags it depends on; every mutation expires the
 * tags it invalidates. Keeping them in one module (rather than string literals
 * scattered across files) means a rename can never silently leave a stale
 * cache behind, which is the classic Cache Components bug.
 */

export const CACHE_TAGS = {
  /** All published cakes: gallery, home rails, sitemap. */
  cakes: "cakes",
  /** A single cake's detail view. */
  cake: (slug: string) => `cake:${slug}`,
  /** Gallery facet counts (tags, occasions). */
  facets: "cake-facets",

  /** All products: the shop listing. */
  products: "products",
  /** A single product's detail view. */
  product: (slug: string) => `product:${slug}`,

  /** Admin dashboard aggregates. */
  adminStats: "admin-stats",
} as const;

/**
 * Gallery page size. Sits here rather than in the page so the cached read and
 * the pagination cursor agree on one number.
 */
export const GALLERY_PAGE_SIZE = 12;

/** Cache lifetime for catalog reads. Freshness after an upload comes from
 *  `updateTag`; this is only the safety net for data changed outside the app. */
export const CATALOG_CACHE_LIFE = "hours" as const;
