import type { MetadataRoute } from "next";
import { getPublishedSlugs } from "@/server/services/cake-service";
import { getProductSlugs } from "@/server/services/product-service";
import { publicEnv } from "@/lib/env";

/**
 * Sitemap.
 *
 * Covers the static pages plus every published bake and product. Order-status
 * pages are deliberately absent: their URLs are effectively bearer tokens and
 * are marked noindex on the page itself.
 *
 * `lastModified` uses the bake date, so Google re-crawls a gallery that is
 * actively growing rather than one that never appears to change.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cakes, products] = await Promise.all([getPublishedSlugs(), getProductSlugs()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${publicEnv.siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${publicEnv.siteUrl}/gallery`, changeFrequency: "daily", priority: 0.9 },
    { url: `${publicEnv.siteUrl}/shop`, changeFrequency: "daily", priority: 0.8 },
    { url: `${publicEnv.siteUrl}/how-to-order`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${publicEnv.siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${publicEnv.siteUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
  ];

  return [
    ...staticRoutes,
    ...cakes.map((cake) => ({
      url: `${publicEnv.siteUrl}/gallery/${cake.slug}`,
      lastModified: cake.bakedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...products.map((slug) => ({
      url: `${publicEnv.siteUrl}/shop/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
