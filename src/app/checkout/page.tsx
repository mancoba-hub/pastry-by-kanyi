import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutForm } from "@/features/orders/checkout-form";
import { getEarliestCollectionLocal } from "@/server/services/site-service";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm your order: collection or delivery, pay on receipt.",
  // A basket is per-visitor; there is nothing here worth indexing.
  robots: { index: false, follow: true },
};

/**
 * Checkout route.
 *
 * A Server Component shell around the client form. The one thing the server
 * needs to contribute is the earliest viable collection time: computing it here
 * (cached, in the kitchen's timezone) keeps `Date.now()` out of the render path
 * and gets the `min` attribute into the initial HTML.
 */
async function CheckoutShell() {
  const earliestLocal = await getEarliestCollectionLocal();

  return <CheckoutForm earliestLocal={earliestLocal} />;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl px-4 py-10">
          <div className="mb-6 h-9 w-40 animate-pbk-pulse rounded bg-[var(--color-surface-muted)]" />
          <div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />
        </div>
      }
    >
      <CheckoutShell />
    </Suspense>
  );
}
