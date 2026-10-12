import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getGalleryFacets, getGalleryPage } from "@/server/services/cake-service";
import { GALLERY_PAGE_SIZE } from "@/server/cache-tags";
import { GalleryFilters } from "@/components/gallery/gallery-filters";
import { GalleryFeed } from "@/components/gallery/gallery-feed";
import { CakeCardSkeleton, type CakeCardData } from "@/components/gallery/cake-card";
import { EmptyState, buttonClasses } from "@/components/ui";
import { whatsappLink } from "@/lib/whatsapp";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Cake gallery",
  description:
    "A working gallery of cakes baked for real customers: birthdays, weddings, baby showers and everything in between.",
  alternates: { canonical: "/gallery" },
};

/**
 * Gallery route.
 *
 * The page shell is static; anything that reads `searchParams` is isolated in a
 * Suspense boundary. Under Cache Components a runtime API outside Suspense
 * cannot be prerendered, so this split is what lets the header, title and
 * filters ship in the instant static shell while the grid streams in.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

async function GalleryFacets({ activeTag, activeOccasion }: { activeTag?: string; activeOccasion?: string }) {
  const facets = await getGalleryFacets();

  return (
    <GalleryFilters facets={facets} activeTag={activeTag} activeOccasion={activeOccasion} />
  );
}

async function GalleryResults({
  tag,
  occasion,
  cursor,
}: {
  tag?: string;
  occasion?: string;
  cursor?: string;
}) {
  const page = await getGalleryPage({
    limit: GALLERY_PAGE_SIZE,
    cursor,
    tagSlug: tag,
    occasion,
  });

  if (page.items.length === 0) {
    return (
      <EmptyState
        title="No bakes match that yet"
        description={
          tag || occasion
            ? "Try a different filter or tell us what you have in mind and we'll bake it."
            : "The gallery is empty for now. The next bake will appear here."
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/gallery" className={buttonClasses({ variant: "secondary" })}>
              Clear filters
            </Link>
            <a
              href={whatsappLink(`Hi ${publicEnv.siteName}! I'd like a cake made.`)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "whatsapp" })}
            >
              Ask for a custom bake
            </a>
          </div>
        }
      />
    );
  }

  return (
    <GalleryFeed initialItems={page.items as CakeCardData[]} initialCursor={page.nextCursor} />
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: GALLERY_PAGE_SIZE }).map((_, index) => (
        <CakeCardSkeleton key={index} />
      ))}
    </div>
  );
}

export default function GalleryPage(props: PageProps<"/gallery">) {
  const searchParams = props.searchParams as SearchParams;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">The gallery</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted-foreground)]">
          Everything here was baked for a real customer and photographed as it left the kitchen.
          Nothing is a stock photo. If you like it, we can make it for you.
        </p>
      </header>

      <div className="mb-8">
        <Suspense fallback={<div className="h-24" />}>
          <FilterSlot searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<ResultsSkeleton />}>
        <ResultsSlot searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Resolves searchParams, then delegates to the cached facet read. */
async function FilterSlot({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  return (
    <GalleryFacets
      activeTag={firstValue(sp.tag)}
      activeOccasion={firstValue(sp.occasion)}
    />
  );
}

async function ResultsSlot({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  return (
    <GalleryResults
      tag={firstValue(sp.tag)}
      occasion={firstValue(sp.occasion)}
      cursor={firstValue(sp.cursor)}
    />
  );
}
