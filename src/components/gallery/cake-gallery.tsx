"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Cake photo gallery.
 *
 * Tapping a thumbnail swaps the main image client-side. Only the visible image
 * is `priority`; the rest are lazy so a cake with eight photos does not stall
 * the first paint on mobile data.
 */
export function CakeGallery({
  images,
  title,
}: {
  images: ReadonlyArray<{
    id: string;
    url: string;
    alt: string;
    width: number;
    height: number;
    blurDataUrl?: string | null;
  }>;
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="flex aspect-4/5 w-full items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-sm text-[var(--color-muted-foreground)]">
        Photos coming soon
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt || title}
          fill
          // Two-up on tablet, full width on phones.
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          placeholder={active.blurDataUrl ? "blur" : "empty"}
          blurDataURL={active.blurDataUrl ?? undefined}
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2" role="tablist" aria-label="Cake photos">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl border transition-opacity",
                  index === activeIndex
                    ? "border-[var(--color-primary)]"
                    : "border-[var(--color-border)] opacity-70 hover:opacity-100",
                )}
                aria-label={`Show photo ${index + 1} of ${images.length}`}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="20vw"
                  className="object-cover"
                  placeholder={image.blurDataUrl ? "blur" : "empty"}
                  blurDataURL={image.blurDataUrl ?? undefined}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
