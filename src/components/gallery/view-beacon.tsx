"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget pageview counter.
 *
 * Deliberately client-side: the cake page is cached and prerendered, so
 * incrementing during render would either run at build time or turn a cached
 * page dynamic. A beacon keeps the page static and the counter eventually
 * consistent.
 *
 * Rendered once per detail view; the server de-duplicates nothing on purpose —
 * "how many times was this opened" is the metric that matters here, not unique
 * visitors, and it only feeds a "most loved" rail.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const controller = new AbortController();

    // `keepalive` lets the request survive the user navigating away immediately.
    void fetch(`/api/v1/cakes/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      keepalive: true,
      signal: controller.signal,
      headers: { "content-type": "application/json" },
    }).catch(() => {
      // A lost pageview is not worth surfacing to the customer.
    });

    return () => controller.abort();
  }, [slug]);

  return null;
}
