import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductSlugs } from "@/server/services/product-service";
import { AddToCart } from "@/features/cart/add-to-cart";
import { Badge, buttonClasses } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { productEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  // See the note in the gallery detail page: resolving this in metadata is what
  // yields a real 404 on the first, uncached request.
  if (!product) notFound();

  return {
    title: product.name,
    description: product.description.slice(0, 300),
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description: product.description.slice(0, 300),
      url: `${publicEnv.siteUrl}/shop/${product.slug}`,
    },
  };
}

async function ProductDetail({ slug }: { slug: string }) {
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const cover = product.images[0];
  const soldOut = product.status === "SOLD_OUT" || product.stockQty === 0;
  const lowStock = !soldOut && product.stockQty !== null && product.stockQty <= 5;

  return (
    <article className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-12">
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt || product.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            placeholder={cover.blurDataUrl ? "blur" : "empty"}
            blurDataURL={cover.blurDataUrl ?? undefined}
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="lg:pt-2">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--color-muted-foreground)]">
          <Link href="/shop" className="hover:text-[var(--color-foreground)]">
            Shop
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-[var(--color-foreground)]">{product.name}</span>
        </nav>

        <div className="flex flex-wrap gap-2">
          {soldOut ? <Badge tone="danger">Sold out</Badge> : null}
          {lowStock ? <Badge tone="warning">Only {product.stockQty} left</Badge> : null}
          {product.isFeatured ? <Badge tone="accent">★ Popular</Badge> : null}
        </div>

        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{product.name}</h1>

        <p className="mt-4 text-[var(--color-muted-foreground)]">{product.description}</p>

        <p className="mt-6 flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{formatMoney(product.priceCents)}</span>
          <span className="text-sm text-[var(--color-muted-foreground)]">{product.unitLabel}</span>
        </p>

        <div className="mt-7 space-y-3">
          <AddToCart
            kind="PRODUCT"
            id={product.id}
            maxQuantity={product.maxPerOrder}
            disabled={soldOut}
            label={soldOut ? "Sold out" : "Add to basket"}
          />

          <a
            href={whatsappLink(productEnquiryMessage(product))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "whatsapp", size: "md", className: "w-full" })}
          >
            Order on WhatsApp
          </a>
        </div>

        <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
          Collection in {publicEnv.businessLocation || "Cape Town"}. Delivery available for larger
          orders — ask us.
        </p>
      </div>
    </article>
  );
}

export default async function ProductPage(props: PageProps<"/shop/[slug]">) {
  // Resolved in the page body, not inside Suspense, so an unknown product slug
  // returns a genuine HTTP 404 rather than a streamed soft 404. See the
  // equivalent note in the gallery detail page.
  const { slug } = await props.params;

  return <ProductDetail slug={slug} />;
}
