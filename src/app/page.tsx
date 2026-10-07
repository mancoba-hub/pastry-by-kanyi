import { Suspense } from "react";
import Link from "next/link";
import { getFeaturedCakes, getMostLovedCakes, getPublishedCakeCount } from "@/server/services/cake-service";
import { getFeaturedProducts } from "@/server/services/product-service";
import { getTodayLabel } from "@/server/services/site-service";
import { CakeCard, CakeCardSkeleton, GalleryGrid, ProductCard } from "@/components/gallery/cake-card";
import { buttonClasses, SectionHeading, Badge } from "@/components/ui";
import { publicEnv } from "@/lib/env";

/**
 * Home page.
 *
 * Every section is its own async component behind `<Suspense>`, so the static
 * shell (header, hero, headings) streams instantly and the data-dependent rails
 * fill in. Under Cache Components this is also what keeps the shell prerenderable
 * while still showing fresh content.
 */

export const metadata = {
  title: `${publicEnv.siteName} — Cakes baked to order`,
  description:
    "Browse a gallery of cakes baked for real customers, order small-batch scones, and place your own cake order on WhatsApp.",
  alternates: { canonical: "/" },
};

async function GalleryStats() {
  const count = await getPublishedCakeCount();

  return (
    <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
      <div>
        <dt className="text-[var(--color-muted-foreground)]">Bakes in the gallery</dt>
        <dd className="text-lg font-semibold">{count}</dd>
      </div>
      <div>
        <dt className="text-[var(--color-muted-foreground)]">Cake lead time</dt>
        <dd className="text-lg font-semibold">48 hours</dd>
      </div>
      <div>
        <dt className="text-[var(--color-muted-foreground)]">Scones</dt>
        <dd className="text-lg font-semibold">Baked daily</dd>
      </div>
    </dl>
  );
}

async function FeaturedRail() {
  const [featured, mostLoved] = await Promise.all([getFeaturedCakes(8), getMostLovedCakes(4)]);
  const rail = featured.length > 0 ? featured : mostLoved;

  if (rail.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No bakes published yet — the gallery is about to get busy.
      </p>
    );
  }

  return (
    <div className="snap-rail -mx-4 px-4 pb-2">
      {rail.map((cake) => (
        <div key={cake.id} className="w-[70%] max-w-xs sm:w-64">
          <CakeCard
            cake={cake}
            sizes="(max-width: 640px) 70vw, 256px"
          />
        </div>
      ))}
    </div>
  );
}

async function RecentBakes() {
  const { getGalleryPage } = await import("@/server/services/cake-service");
  const page = await getGalleryPage({ limit: 8 });

  if (page.items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Photos from the next bake will appear here.
      </p>
    );
  }

  return <GalleryGrid cakes={page.items} priorityCount={4} />;
}

async function ShopTeaser() {
  const products = await getFeaturedProducts(3);
  if (products.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14">
      <SectionHeading
        title="From the shop"
        subtitle="Small-batch scones and pastries, baked the same morning."
        action={
          <Link href="/shop" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            See all
          </Link>
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Sits behind Suspense so the shell never waits on a database or clock read
 * purely to render a date-dependent greeting. `getTodayLabel()` is cached, so
 * this resolves from the cache in the common case.
 */
async function SeasonalGreeting() {
  const label = await getTodayLabel();

  return <Badge tone="accent">Fresh today · {label}</Badge>;
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <Suspense fallback={null}>
            <SeasonalGreeting />
          </Suspense>

          <h1 className="mt-4 max-w-2xl text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
            Every cake here was baked for someone&apos;s big day.
          </h1>

          <p className="mt-5 max-w-xl text-base text-[var(--color-muted-foreground)] sm:text-lg">
            A working gallery of recent bakes — browse what&apos;s possible, then tell us what you
            have in mind. Cakes are baked to order; scones come in small batches.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/gallery" className={buttonClasses({ size: "lg" })}>
              Browse the gallery
            </Link>
            <Link
              href="/shop"
              className={buttonClasses({ variant: "secondary", size: "lg" })}
            >
              Order scones
            </Link>
          </div>

          <Suspense
            fallback={
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div className="h-12 w-28 animate-pbk-pulse rounded bg-[var(--color-surface)]" />
                <div className="h-12 w-28 animate-pbk-pulse rounded bg-[var(--color-surface)]" />
              </dl>
            }
          >
            <GalleryStats />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <SectionHeading
          title="Latest bakes"
          subtitle="Fresh out of the oven, newest first."
          action={
            <Link href="/gallery" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              View all →
            </Link>
          }
        />

        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <CakeCardSkeleton />
              <CakeCardSkeleton />
              <CakeCardSkeleton />
              <CakeCardSkeleton />
            </div>
          }
        >
          <RecentBakes />
        </Suspense>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <SectionHeading title="Signature cakes" subtitle="The ones we're asked for most." />

          <Suspense
            fallback={
              <div className="snap-rail -mx-4 px-4 pb-2">
                <div className="w-[70%] max-w-xs sm:w-64">
                  <CakeCardSkeleton />
                </div>
                <div className="w-[70%] max-w-xs sm:w-64">
                  <CakeCardSkeleton />
                </div>
                <div className="w-[70%] max-w-xs sm:w-64">
                  <CakeCardSkeleton />
                </div>
              </div>
            }
          >
            <FeaturedRail />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={null}>
        <ShopTeaser />
      </Suspense>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">Got a date in mind?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--color-muted-foreground)]">
            Send us the occasion, the number of guests and any inspiration you have. We&apos;ll come
            back with a plan and a quote — usually the same day.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className={buttonClasses({ size: "lg" })}>
              Start an enquiry
            </Link>
            <Link href="/gallery" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Get inspired
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
