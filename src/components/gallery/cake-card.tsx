import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

/**
 * Gallery card.
 *
 * This is the most-rendered component on the site, so it is tuned for the
 * mobile case: a fixed aspect ratio (no layout shift while photos load), a blur
 * placeholder already inlined by the server, and `sizes` that matches the real
 * grid so the browser never downloads a 2000px image for a half-width tile.
 *
 * Deliberately a Server Component — no state, no handlers — so it contributes
 * nothing to the client bundle.
 */

export type CakeCardData = {
  slug: string;
  title: string;
  flavour?: string | null;
  occasion?: string | null;
  priceCents?: number | null;
  isFeatured?: boolean;
  servings?: number | null;
  tags?: ReadonlyArray<{ label: string }>;
  images: ReadonlyArray<{
    url: string;
    alt: string;
    width: number;
    height: number;
    blurDataUrl?: string | null;
  }>;
};

export function CakeCard({
  cake,
  priority = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: {
  cake: CakeCardData;
  priority?: boolean;
  sizes?: string;
}) {
  const cover = cake.images[0];

  return (
    <Link
      href={`/gallery/${cake.slug}`}
      className="group block overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-shadow hover:shadow-lg focus-visible:shadow-lg"
      prefetch={false}
    >
      <div className="relative aspect-4/5 w-full overflow-hidden bg-[var(--color-surface-muted)]">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            sizes={sizes}
            priority={priority}
            loading={priority ? undefined : "lazy"}
            placeholder={cover.blurDataUrl ? "blur" : "empty"}
            blurDataURL={cover.blurDataUrl ?? undefined}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
            No photo yet
          </div>
        )}

        {cake.isFeatured ? (
          <Badge tone="accent" className="absolute top-2.5 left-2.5 shadow-sm">
            ★ Signature
          </Badge>
        ) : null}
      </div>

      <div className="p-3 sm:p-4">
        <h3 className="line-clamp-2 text-[0.95rem] leading-snug font-semibold sm:text-base">
          {cake.title}
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
          {cake.flavour ? <span className="line-clamp-1">{cake.flavour}</span> : null}
          {cake.occasion ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{cake.occasion}</span>
            </>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            {cake.priceCents != null ? formatMoney(cake.priceCents) : "On request"}
          </span>
          {cake.servings ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              serves {cake.servings}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Product tile for the shop (scones, etc.). */
export function ProductCard({
  product,
  className,
}: {
  product: {
    slug: string;
    name: string;
    description: string;
    priceCents: number;
    unitLabel: string;
    status: string;
    stockQty: number | null;
    images: ReadonlyArray<{
      url: string;
      alt: string;
      width: number;
      height: number;
      blurDataUrl?: string | null;
    }>;
  };
  className?: string;
}) {
  const cover = product.images[0];
  const soldOut = product.status === "SOLD_OUT" || product.stockQty === 0;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-shadow hover:shadow-lg",
        className,
      )}
      prefetch={false}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--color-surface-muted)]">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            placeholder={cover.blurDataUrl ? "blur" : "empty"}
            blurDataURL={cover.blurDataUrl ?? undefined}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
            No photo yet
          </div>
        )}

        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge tone="danger">Sold out</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold">{product.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-[var(--color-muted-foreground)]">
          {product.description}
        </p>

        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-semibold">{formatMoney(product.priceCents)}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">{product.unitLabel}</span>
        </div>
      </div>
    </Link>
  );
}

/** Skeleton shown while a streamed gallery section resolves. */
export function CakeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="aspect-4/5 w-full animate-pbk-pulse bg-[var(--color-surface-muted)]" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pbk-pulse rounded bg-[var(--color-surface-muted)]" />
        <div className="h-3 w-1/2 animate-pbk-pulse rounded bg-[var(--color-surface-muted)]" />
      </div>
    </div>
  );
}

/** Responsive gallery grid. `priority` is applied to the first row only. */
export function GalleryGrid({
  cakes,
  priorityCount = 4,
}: {
  cakes: readonly CakeCardData[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {cakes.map((cake, index) => (
        <li key={cake.slug}>
          <CakeCard cake={cake} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
