import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/**
 * Crawler rules.
 *
 * `/admin` is disallowed and also sends `noindex`, and `/order` is disallowed
 * outright — an order URL contains its reference, which functions as a
 * credential for that order.
 */
export default function robots(): MetadataRoute.Robots {
  const isPublicDeploy = publicEnv.siteUrl.startsWith("https://");

  return {
    rules: isPublicDeploy
      ? [
          { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/order", "/order-lookup", "/checkout", "/cart"] },
        ]
      : // Never let a staging or preview deployment get indexed.
        [{ userAgent: "*", disallow: "/" }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
    host: publicEnv.siteUrl,
  };
}
