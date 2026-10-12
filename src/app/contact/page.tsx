import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { leadTimeLabel } from "@/features/orders/schema";

export const metadata: Metadata = {
  title: "Contact",
  description: `Order a cake or ask about scones — message Pastry Box by Kanyi in ${publicEnv.businessLocation || "Cape Town"}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const message = `Hi ${publicEnv.siteName}! I'd like to order a cake.\n\nDate of collection: \nFlavour: \nInspiration picture: \nNumber of servings/size: `;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Let&apos;s plan your cake</h1>

      <p className="mt-4 max-w-xl text-[var(--color-muted-foreground)]">
        WhatsApp is the fastest way to reach us — we usually reply the same day. Tell us the
        occasion, the date and roughly how many people you&apos;re feeding, and we&apos;ll come back
        with ideas and a price.
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
      </div>

      <dl className="mt-12 grid gap-6 sm:grid-cols-2">
        {publicEnv.businessPhone ? (
          <div>
            <dt className="text-sm text-[var(--color-muted-foreground)]">Phone</dt>
            <dd className="mt-1 font-medium">
              <a href={`tel:${publicEnv.businessPhone.replace(/\s/g, "")}`} className="hover:underline">
                {publicEnv.businessPhone}
              </a>
            </dd>
          </div>
        ) : null}

        {publicEnv.businessEmail ? (
          <div>
            <dt className="text-sm text-[var(--color-muted-foreground)]">Email</dt>
            <dd className="mt-1 font-medium">
              <a href={`mailto:${publicEnv.businessEmail}`} className="hover:underline">
                {publicEnv.businessEmail}
              </a>
            </dd>
          </div>
        ) : null}

        {publicEnv.businessLocation ? (
          <div>
            <dt className="text-sm text-[var(--color-muted-foreground)]">Kitchen</dt>
            <dd className="mt-1 font-medium">{publicEnv.businessLocation}</dd>
          </div>
        ) : null}

        {publicEnv.instagramHandle ? (
          <div>
            <dt className="text-sm text-[var(--color-muted-foreground)]">Instagram</dt>
            <dd className="mt-1 font-medium">
              <a
                href={`https://instagram.com/${publicEnv.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                @{publicEnv.instagramHandle}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-12 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm">
        <p className="font-medium">Please give us at least {leadTimeLabel()}&apos;s notice.</p>
        <p className="mt-1.5 text-[var(--color-muted-foreground)]">
          Cakes are baked to order from scratch, so we can&apos;t turn one around same-day. Late
          orders are accommodated only if we have capacity, and that depends on the design. Scones
          are more flexible — ask.
        </p>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          A 50% deposit secures your order (orders of R200 or less are paid in full), and the
          balance is settled the day before collection.{" "}
          <Link
            href="/how-to-order"
            className="font-medium text-[var(--color-foreground)] underline underline-offset-2"
          >
            See how to order
          </Link>{" "}
          for everything we need from you.
        </p>
      </div>
    </div>
  );
}
