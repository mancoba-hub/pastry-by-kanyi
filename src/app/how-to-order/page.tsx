import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bentoRange from "@/images/bento-range.jpeg";
import flavours from "@/images/flavours.jpeg";
import priceList from "@/images/price-list.jpeg";
import { buttonClasses } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { leadTimeLabel } from "@/features/orders/schema";

export const metadata: Metadata = {
  title: "How to order",
  description:
    "How to order a cake from Pastry by Kanyi: what to send us on WhatsApp, deposits and payment, collection, plus our flavour list, price list and bento range.",
  alternates: { canonical: "/how-to-order" },
};

/** The four things a quote needs — without them we can only guess at a price. */
const ORDER_DETAILS = [
  {
    label: "Date of collection",
    detail: "The day you need the cake, so we can plan the bake around it.",
  },
  {
    label: "Flavour",
    detail: "Refer to the flavour list below and tell us which one you have chosen.",
  },
  {
    label: "Inspiration picture",
    detail: "A photo or a link to the look you have in mind.",
  },
  {
    label: "Number of servings / size",
    detail: "Roughly how many people the cake needs to feed.",
  },
] as const;

/**
 * Flavours, prices and the bento range are designed documents rather than
 * database rows, so they ship with the site and are rendered as-is.
 */
const LISTS = [
  {
    image: flavours,
    title: "Flavour list",
    alt: "Pastry by Kanyi flavour list",
    caption: "Every flavour we bake, from classic vanilla to the richer celebration combinations.",
  },
  {
    image: priceList,
    title: "Price list",
    alt: "Pastry by Kanyi price list",
    caption: "Starting prices only — your quote depends on size, design and the detail you ask for.",
  },
  {
    image: bentoRange,
    title: "Bento range",
    alt: "Pastry by Kanyi bento cake range",
    caption: "Small bento bakes for birthdays, thank-yous and last-minute surprises.",
  },
] as const;

export default function HowToOrderPage() {
  const message = `Hi ${publicEnv.siteName}! I'd like to order a cake.\n\nDate of collection: \nFlavour: \nInspiration picture: \nNumber of servings/size: `;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">How to order</h1>

      <p className="mt-4 max-w-xl text-[var(--color-muted-foreground)]">
        Orders are placed on WhatsApp. Everything is baked to order, so the more notice you give us
        the better your cake — and the easier your date is to secure.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={whatsappLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: "whatsapp", size: "lg" })}
        >
          Start on WhatsApp
        </a>
        <Link href="/gallery" className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Browse the gallery
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Place your order</h2>
        <div className="mt-4 space-y-3 text-[var(--color-muted-foreground)]">
          <p>
            Please place your order on WhatsApp at least{" "}
            <strong className="font-semibold text-[var(--color-foreground)]">{leadTimeLabel()}</strong>{" "}
            before collection.
          </p>
          <p>
            Late orders are accommodated only if we have capacity, and that depends on the design —
            the simpler the cake, the likelier we can fit it in.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Send us these details</h2>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          When you ask for an order or a quote, please include:
        </p>

        <dl className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {ORDER_DETAILS.map((item) => (
            <div key={item.label} className="py-4">
              <dt className="font-medium">{item.label}</dt>
              <dd className="mt-1 text-sm text-[var(--color-muted-foreground)]">{item.detail}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-[var(--color-muted-foreground)]">
          Once you receive a quote, please let us know whether you accept or decline it.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Payment</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted-foreground)]">
            <li>A 50% deposit secures your order.</li>
            <li>Orders that are R200 or less require the full amount.</li>
          </ul>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Collection</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted-foreground)]">
            <li>Full settlement of the outstanding balance the day before collection.</li>
            <li>Collection is from our kitchen in {publicEnv.businessLocation || "Cape Town"}.</li>
          </ul>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Flavours, prices &amp; bento range</h2>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          The price list shows starting prices, not final ones — every quote depends on the size,
          the design and the detail you ask for.
        </p>

        <div className="mt-6 space-y-8">
          {LISTS.map((item) => (
            <figure
              key={item.title}
              className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white"
            >
              <Image
                src={item.image}
                alt={item.alt}
                sizes="(min-width: 768px) 768px, 100vw"
                quality={90}
                placeholder="blur"
                className="h-auto w-full"
              />
              <figcaption className="border-t border-[var(--color-border)] p-4 text-sm">
                <span className="font-medium">{item.title}</span>
                <span className="mt-1 block text-[var(--color-muted-foreground)]">{item.caption}</span>
                <a
                  href={item.image.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-medium underline underline-offset-2"
                >
                  Open full size
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
        <h2 className="text-xl font-semibold">Still deciding?</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Send us your date and an inspiration picture — we are happy to talk through sizes and
          flavours before you commit to anything.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={whatsappLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "whatsapp" })}
          >
            Message us
          </a>
          <Link href="/shop" className={buttonClasses({ variant: "secondary" })}>
            Shop scones
          </Link>
        </div>
      </div>
    </div>
  );
}
