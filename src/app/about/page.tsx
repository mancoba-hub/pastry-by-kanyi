import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { leadTimeLabel } from "@/features/orders/schema";

export const metadata: Metadata = {
  title: "About",
  description: `${publicEnv.siteName} bakes cakes to order and small-batch scones in ${publicEnv.businessLocation || "Cape Town"}.`,
  alternates: { canonical: "/about" },
};

const FAQ = [
  {
    question: `How much notice do you need?`,
    answer: `At least ${leadTimeLabel()} for cakes — the earlier the better, especially around December. Late orders only go ahead if we have capacity, and that depends on the design you are after.`,
  },
  {
    question: "Do you deliver?",
    answer:
      "Collection is from our kitchen. Delivery within Cape Town can be arranged for larger orders — message us with your location and we'll quote it.",
  },
  {
    question: "Can you copy a cake I've seen online?",
    answer:
      "We'll always bake you something in that style, but we won't make an exact replica of another baker's work. Send us the inspiration and we'll design our own version of it.",
  },
  {
    question: "How do I pay?",
    answer:
      "No online payment. We confirm the order on WhatsApp — a 50% deposit secures your slot, and orders of R200 or less are paid in full. The outstanding balance is settled the day before collection.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">About Pastry Box by Kanyi</h1>

      <div className="mt-6 space-y-5 text-[var(--color-muted-foreground)]">
        <p>
          We are a small kitchen in {publicEnv.businessLocation || "Cape Town"} baking cakes to order
          and scones in small batches, the same morning they are eaten.
        </p>
        <p>
          Every cake in the gallery was made for a real customer and photographed as it left the
          kitchen. Nothing is staged and nothing is a stock photo — it is simply a record of what
          we have baked and what we are able to bake.
        </p>
        <p>
          We bake to order rather than ahead. It means we ask for a little more notice, and it is
          why a cake from here tastes like it was made for you: because it was.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Common questions</h2>
        <dl className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {FAQ.map((item) => (
            <div key={item.question} className="py-4">
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-12 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
        <h2 className="text-xl font-semibold">Ready to order?</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/gallery" className={buttonClasses()}>
            Browse the gallery
          </Link>
          <Link href="/how-to-order" className={buttonClasses({ variant: "secondary" })}>
            How to order
          </Link>
          <a
            href={whatsappLink(`Hi ${publicEnv.siteName}! I have a question.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "whatsapp" })}
          >
            Message us
          </a>
        </div>
      </div>
    </div>
  );
}
