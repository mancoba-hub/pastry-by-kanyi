import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCakeBySlug,
  getPublishedSlugs,
  getRelatedCakes,
} from "@/server/services/cake-service";
import { CakeGallery } from "@/components/gallery/cake-gallery";
import { CakeCard } from "@/components/gallery/cake-card";
import { ShareButton } from "@/components/gallery/share-button";
import { ViewBeacon } from "@/components/gallery/view-beacon";
import { AddToCart } from "@/features/cart/add-to-cart";
import { Badge, buttonClasses, SectionHeading } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { whatsappLink, cakeEnquiryMessage } from "@/lib/whatsapp";
import { leadTimeLabel } from "@/features/orders/schema";

/**
 * Cake detail page.
 *
 * This is the page that gets shared, so it carries the full metadata weight:
 * canonical URL, OpenGraph, Twitter card, and a generated preview image. It is
 * prerendered for every published slug and served from cache, which is what
 * keeps a link going viral on WhatsApp from touching the database.
 */

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();

  // Cap what we prerender at build; anything beyond is generated on first
  // request and then cached, so a 500-cake gallery cannot slow down a deploy.
  return slugs.slice(0, 200).map((cake) => ({ slug: cake.slug }));
}

export async function generateMetadata(props: PageProps<"/gallery/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const cake = await getCakeBySlug(slug);

  // Calling `notFound()` from `generateMetadata` is what makes an unknown slug a
  // genuine HTTP 404 — including on the very first, cache-missing request.
  //
  // Metadata resolves before the response shell is flushed, so the status code
  // is still negotiable. Throwing `notFound()` from the page body instead only
  // works once the route is cached, because by then the 200 has already gone out
  // (the layout contains Suspense boundaries, so the shell streams immediately).
  //
  // The lookup is shared with the page through the cache, so this costs no
  // extra query.
  if (!cake) notFound();

  const description = `${cake.flavour ? `${cake.flavour}. ` : ""}${cake.description}`.slice(0, 300);

  return {
    title: cake.title,
    description,
    alternates: { canonical: `/gallery/${cake.slug}` },
    openGraph: {
      type: "article",
      title: cake.title,
      description,
      url: `${publicEnv.siteUrl}/gallery/${cake.slug}`,
      // `opengraph-image.tsx` in this route generates the card; listing it
      // explicitly guarantees the dimensions WhatsApp needs.
      images: [{ url: `/gallery/${cake.slug}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: cake.title,
      description,
      images: [`/gallery/${cake.slug}/opengraph-image`],
    },
    other: {
      // Product-ish hints for rich results.
      "product:price:amount": cake.priceCents != null ? String(cake.priceCents / 100) : "",
      "product:price:currency": publicEnv.currency,
    },
  };
}

async function RelatedRail({ cakeId, tagSlugs }: { cakeId: string; tagSlugs: string[] }) {
  const related = await getRelatedCakes(cakeId, tagSlugs, 4);
  if (related.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16">
      <SectionHeading title="You might also like" />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {related.map((cake) => (
          <li key={cake.id}>
            <CakeCard cake={cake} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function CakeDetail({ slug }: { slug: string }) {
  const cake = await getCakeBySlug(slug);
  if (!cake) notFound();

  const tagSlugs = cake.tags.map((t) => t.slug);
  const enquiry = cakeEnquiryMessage({ title: cake.title, slug: cake.slug });

  return (
    <>
      <ViewBeacon slug={cake.slug} />

      <nav
        aria-label="Breadcrumb"
        className="mx-auto w-full max-w-6xl px-4 pt-6 text-sm text-[var(--color-muted-foreground)]"
      >
        <Link href="/gallery" className="hover:text-[var(--color-foreground)]">
          Gallery
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-[var(--color-foreground)]">{cake.title}</span>
      </nav>

      <article className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 lg:grid-cols-2 lg:gap-12">
        <CakeGallery images={cake.images} title={cake.title} />

        <div className="lg:pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {cake.isFeatured ? <Badge tone="accent">★ Signature bake</Badge> : null}
            {cake.occasion ? <Badge tone="neutral">{cake.occasion}</Badge> : null}
          </div>

          <h1 className="mt-3 text-3xl leading-tight font-semibold sm:text-4xl">{cake.title}</h1>

          <p className="mt-4 text-[var(--color-muted-foreground)]">{cake.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
            <div>
              <dt className="text-[var(--color-muted-foreground)]">Price</dt>
              <dd className="mt-0.5 text-lg font-semibold">
                {cake.priceCents != null ? formatMoney(cake.priceCents) : "On request"}
              </dd>
            </div>
            {cake.servings ? (
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Serves</dt>
                <dd className="mt-0.5 text-lg font-semibold">{cake.servings}</dd>
              </div>
            ) : null}
            {cake.flavour ? (
              <div className="col-span-2">
                <dt className="text-[var(--color-muted-foreground)]">Flavour</dt>
                <dd className="mt-0.5">{cake.flavour}</dd>
              </div>
            ) : null}
            <div className="col-span-2">
              <dt className="text-[var(--color-muted-foreground)]">Lead time</dt>
              <dd className="mt-0.5">
                At least {leadTimeLabel()} — we bake to order, never ahead.
              </dd>
            </div>
          </dl>

          {tagSlugs.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {cake.tags.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={`/gallery?tag=${encodeURIComponent(tag.slug)}`}
                    className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs hover:bg-[var(--color-surface-muted)]"
                  >
                    {tag.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-7 space-y-3">
            {cake.priceCents != null ? (
              <AddToCart kind="CAKE" id={cake.id} label="Add to basket" />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <a
                href={whatsappLink(enquiry)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({
                  variant: cake.priceCents != null ? "secondary" : "whatsapp",
                  size: "md",
                  className: "flex-1",
                })}
              >
                {cake.priceCents != null ? "Order on WhatsApp" : "Ask for a quote"}
              </a>

              <ShareButton slug={cake.slug} title={cake.title} />
            </div>
          </div>

          <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
            Prices are a guide — final cost depends on size, detailing and delivery. Message us and
            we&apos;ll confirm.
          </p>
        </div>
      </article>

      <Suspense fallback={null}>
        <RelatedRail cakeId={cake.id} tagSlugs={tagSlugs} />
      </Suspense>
    </>
  );
}

export default async function CakePage(props: PageProps<"/gallery/[slug]">) {
  // `params` and the cake lookup deliberately happen in the page body rather
  // than inside a `<Suspense>` boundary.
  //
  // `notFound()` thrown from inside a streamed boundary cannot change the status
  // code — the 200 has already gone out, producing a "soft 404" that search
  // engines will happily index. Resolving before the response starts streaming
  // is what makes an unknown slug a real HTTP 404.
  //
  // Nothing is lost: `getCakeBySlug` is cached and every published slug is in
  // `generateStaticParams`, so the common path is still a prerendered page.
  const { slug } = await props.params;

  return <CakeDetail slug={slug} />;
}
