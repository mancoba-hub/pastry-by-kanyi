import { Suspense } from "react";
import type { Metadata } from "next";
import { getShopProducts } from "@/server/services/product-service";
import { ProductCard } from "@/components/gallery/cake-card";
import { EmptyState, SectionHeading, buttonClasses } from "@/components/ui";
import { whatsappLink } from "@/lib/whatsapp";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Shop — scones & pastries",
  description: "Small-batch scones and pastries, baked the same morning. Order for collection or delivery.",
  alternates: { canonical: "/shop" },
};

async function ProductList() {
  const products = await getShopProducts();

  if (products.length === 0) {
    return (
      <EmptyState
        title="Nothing on the shelf right now"
        description="We bake in small batches. Message us and we'll tell you what's coming out of the oven next."
        action={
          <a
            href={whatsappLink(`Hi ${publicEnv.siteName}! What are you baking this week?`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "whatsapp" })}
          >
            Ask what&apos;s baking
          </a>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

export default function ShopPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">The shop</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted-foreground)]">
          Scones and pastries, baked in small batches. Order for collection in Cape Town, or ask about
          delivery for larger orders.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
              />
            ))}
          </div>
        }
      >
        <ProductList />
      </Suspense>

      <section className="mt-14">
        <SectionHeading
          title="Ordering a lot?"
          subtitle="Offices, events and cafés — talk to us about a standing order."
        />
        <a
          href={whatsappLink(`Hi ${publicEnv.siteName}! I'd like to talk about a regular scone order.`)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ size: "lg" })}
        >
          Start a conversation
        </a>
      </section>
    </div>
  );
}
