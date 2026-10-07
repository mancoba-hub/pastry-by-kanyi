"use client";

import { useState } from "react";
import { CakeCard, CakeCardSkeleton, type CakeCardData } from "./cake-card";
import { buttonClasses } from "@/components/ui";

/**
 * Cursor-fed gallery list.
 *
 * The first page arrives server-rendered (fast, indexed, no loading state), and
 * "Load more" appends through the public API. Appending rather than navigating
 * means the reader keeps their scroll position — which matters a lot on a phone
 * when you are three screens into a photo grid.
 *
 * The cursor is opaque and comes from the server, so the client never has to
 * know how ordering works.
 */
export function GalleryFeed({
  initialItems,
  initialCursor,
}: {
  initialItems: CakeCardData[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState<CakeCardData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = async () => {
    if (!cursor || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/cakes?cursor=${encodeURIComponent(cursor)}`, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        // A spent cursor is a normal end-of-list condition, not an error.
        if (response.status === 404) {
          setCursor(null);
          return;
        }
        throw new Error(`Request failed (${response.status})`);
      }

      const payload: { data: CakeCardData[]; meta?: { nextCursor?: string | null } } =
        await response.json();

      // Guard against duplicates: a bake uploaded mid-scroll can shift the
      // window, and rendering it twice would break React keys.
      setItems((current) => {
        const seen = new Set(current.map((c) => c.slug));
        return [...current, ...payload.data.filter((c) => !seen.has(c.slug))];
      });

      setCursor(payload.meta?.nextCursor ?? null);
    } catch {
      setError("We couldn't load more bakes. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((cake, index) => (
          <li key={cake.slug}>
            {/* Only the first row is a priority; the rest lazy-load. */}
            <CakeCard cake={cake} priority={index < 4} />
          </li>
        ))}
      </ul>

      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <CakeCardSkeleton />
          <CakeCardSkeleton />
          <CakeCardSkeleton />
          <CakeCardSkeleton />
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 text-center text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {cursor ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className={buttonClasses({ variant: "secondary", size: "lg" })}
          >
            {loading ? "Loading…" : "Load more bakes"}
          </button>
        </div>
      ) : items.length > 0 ? (
        <p className="mt-8 text-center text-sm text-[var(--color-muted-foreground)]">
          That&apos;s every bake in the gallery so far.
        </p>
      ) : null}
    </div>
  );
}
