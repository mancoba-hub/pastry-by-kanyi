import Link from "next/link";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui";

/**
 * Gallery facets.
 *
 * Rendered as plain `<Link>`s rather than a client-side filter widget: the
 * filter state belongs in the URL (shareable, back-button friendly, crawlable),
 * and anchors cost zero JavaScript. On a mid-range Android over 3G that is a
 * measurable difference over shipping a component that calls `router.push`.
 */

export type Facets = {
  tags: { label: string; slug: string; count: number }[];
  occasions: { label: string; count: number }[];
};

function buildHref(base: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function GalleryFilters({
  facets,
  activeTag,
  activeOccasion,
  basePath = "/gallery",
}: {
  facets: Facets;
  activeTag?: string;
  activeOccasion?: string;
  basePath?: string;
}) {
  const hasFilters = Boolean(activeTag || activeOccasion);

  if (facets.tags.length === 0 && facets.occasions.length === 0) return null;

  return (
    <div className="space-y-4">
      {facets.occasions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-[var(--color-muted-foreground)] uppercase">
            Occasion
          </span>

          {facets.occasions.map((occasion) => {
            const active = activeOccasion === occasion.label;

            return (
              <Link
                key={occasion.label}
                href={buildHref(basePath, {
                  occasion: active ? undefined : occasion.label,
                  tag: activeTag,
                })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]",
                )}
              >
                {occasion.label}
                <span className="ml-1.5 opacity-60">{occasion.count}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {facets.tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-[var(--color-muted-foreground)] uppercase">
            Style
          </span>

          {facets.tags.map((tag) => {
            const active = activeTag === tag.slug;

            return (
              <Link
                key={tag.slug}
                href={buildHref(basePath, {
                  tag: active ? undefined : tag.slug,
                  occasion: activeOccasion,
                })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]",
                )}
              >
                {tag.label}
                <span className="ml-1.5 opacity-60">{tag.count}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {hasFilters ? (
        <div className="flex items-center gap-3 pt-1">
          <Badge tone="primary">Filtered</Badge>
          <Link
            href={basePath}
            className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
          >
            Clear filters
          </Link>
        </div>
      ) : null}
    </div>
  );
}
