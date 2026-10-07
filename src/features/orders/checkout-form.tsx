"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, toOrderItems } from "@/features/cart/use-cart";
import { usePricedBasket } from "@/features/cart/use-priced-basket";
import { basketIdempotencyKey } from "@/features/cart/idempotency";
import { buttonClasses, EmptyState, FieldError, inputClasses, Label } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { LEAD_TIME_HOURS } from "@/features/orders/schema";

/**
 * Checkout form.
 *
 * A Client Component because there is no customer account: the basket only
 * exists in the browser. Everything that matters is verified again on the
 * server — `placeOrder()` re-validates the payload, re-prices every line from
 * the catalog and re-checks availability, so a tampered request cannot buy a
 * cake for one rand.
 *
 * The idempotency key is derived from the basket contents, so a double-tap or a
 * retry after a dropped connection returns the original order rather than
 * baking a second cake.
 *
 * `earliestLocal` is computed on the server (see `getEarliestCollectionLocal`)
 * and passed down, which keeps `Date.now()` out of the render path entirely and
 * puts the `min` attribute in the first byte of HTML.
 */

type FieldErrors = Record<string, string[]>;

export function CheckoutForm({ earliestLocal }: { earliestLocal: string }) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();

  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const { basket, loading: pricingLoading, error: pricingError, problems } = usePricedBasket(fulfilment);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Note what is NOT gated behind `ready`: the form itself.
  //
  // The basket lives in localStorage, so it is unknowable on the server — but
  // the customer's name, phone and date fields are static. Rendering the whole
  // form only after hydration would mean a blank page on a slow phone and no
  // form fields in the initial HTML. Only the basket-derived parts wait.

  const basketEmpty = ready && lines.length === 0;

  // Only shown once hydration has confirmed the basket really is empty —
  // otherwise a returning customer with a stored basket would briefly see
  // "nothing to check out" on every page load.
  if (basketEmpty) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-14">
        <EmptyState
          title="Nothing to check out"
          description="Your basket is empty — find something you like first."
          action={
            <Link href="/gallery" className={buttonClasses()}>
              Browse the gallery
            </Link>
          }
        />
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const requestedFor = String(formData.get("requestedFor") ?? "").trim();

    const body = {
      customerName: String(formData.get("customerName") ?? "").trim(),
      customerPhone: String(formData.get("customerPhone") ?? "").trim(),
      customerEmail: String(formData.get("customerEmail") ?? "").trim(),
      fulfilment,
      deliveryAddress: String(formData.get("deliveryAddress") ?? "").trim(),
      requestedFor: requestedFor ? new Date(requestedFor).toISOString() : undefined,
      notes: String(formData.get("notes") ?? "").trim(),
      items: toOrderItems(lines),
      idempotencyKey: basketIdempotencyKey(lines),
    };

    try {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        const error = payload?.error ?? {};
        setFormError(error.message ?? "We could not place that order.");
        setFieldErrors(error.fields ?? {});
        return;
      }

      // The order exists now; the basket has served its purpose.
      clear();
      router.push(`/order/${payload.data.publicRef}?placed=1`);
    } catch {
      setFormError("We could not reach the kitchen. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <fieldset className="space-y-4">
            <legend className="mb-2 font-medium">Your details</legend>

            <div>
              <Label htmlFor="customerName">Name</Label>
              <input
                id="customerName"
                name="customerName"
                required
                autoComplete="name"
                className={inputClasses}
                aria-invalid={Boolean(fieldErrors.customerName)}
              />
              <FieldError messages={fieldErrors.customerName} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="customerPhone">Phone (WhatsApp)</Label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  className={inputClasses}
                  aria-invalid={Boolean(fieldErrors.customerPhone)}
                />
                <FieldError messages={fieldErrors.customerPhone} />
              </div>

              <div>
                <Label htmlFor="customerEmail" hint="(optional)">
                  Email
                </Label>
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  autoComplete="email"
                  className={inputClasses}
                  aria-invalid={Boolean(fieldErrors.customerEmail)}
                />
                <FieldError messages={fieldErrors.customerEmail} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-medium">Collection or delivery</legend>

            <div className="grid grid-cols-2 gap-3">
              {(["PICKUP", "DELIVERY"] as const).map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${
                    fulfilment === option
                      ? "border-[var(--color-primary)] bg-[#fae8ed]"
                      : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfilment"
                    value={option}
                    checked={fulfilment === option}
                    onChange={() => setFulfilment(option)}
                    className="accent-[var(--color-primary)]"
                  />
                  <span className="font-medium">
                    {option === "PICKUP" ? "Collection" : "Delivery"}
                  </span>
                </label>
              ))}
            </div>

            {fulfilment === "DELIVERY" ? (
              <div>
                <Label htmlFor="deliveryAddress">Delivery address</Label>
                <textarea
                  id="deliveryAddress"
                  name="deliveryAddress"
                  rows={3}
                  required
                  placeholder="Estate, street, building, apartment, landmark"
                  className={inputClasses}
                  aria-invalid={Boolean(fieldErrors.deliveryAddress)}
                />
                <FieldError messages={fieldErrors.deliveryAddress} />
                {publicEnv.deliveryFeeCents > 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Delivery fee: {formatMoney(publicEnv.deliveryFeeCents)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    We&apos;ll confirm the delivery fee on WhatsApp based on your location.
                  </p>
                )}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-medium">When do you need it?</legend>

            <div>
              <Label htmlFor="requestedFor" hint={`(at least ${LEAD_TIME_HOURS}h ahead)`}>
                Date &amp; time
              </Label>
              <input
                id="requestedFor"
                name="requestedFor"
                type="datetime-local"
                min={earliestLocal || undefined}
                defaultValue={earliestLocal || undefined}
                className={inputClasses}
                aria-invalid={Boolean(fieldErrors.requestedFor)}
              />
              <FieldError messages={fieldErrors.requestedFor} />
            </div>

            <div>
              <Label htmlFor="notes" hint="(optional)">
                Anything we should know?
              </Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Colours, message on the cake, allergies, inspiration…"
                className={inputClasses}
                aria-invalid={Boolean(fieldErrors.notes)}
              />
              <FieldError messages={fieldErrors.notes} />
            </div>
          </fieldset>

          {formError ? (
            <div
              className="rounded-xl border border-[var(--color-danger)] bg-[#fdeceb] px-4 py-3 text-sm"
              role="alert"
            >
              <p className="font-medium text-[var(--color-danger)]">{formError}</p>
              {problems.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || pricingLoading || !basket}
            className={buttonClasses({ size: "lg", className: "w-full" })}
          >
            {submitting ? "Placing your order…" : "Place order"}
          </button>

          <p className="text-xs text-[var(--color-muted-foreground)]">
            No payment online. We confirm every order on WhatsApp and you pay on collection or
            delivery.
          </p>
        </form>

        <aside className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:sticky lg:top-24">
          <h2 className="mb-3 font-medium">Order summary</h2>

          {pricingError ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {pricingError}
            </p>
          ) : null}

          {basket ? (
            <>
              <ul className="space-y-2 text-sm">
                {basket.lines.map((line) => (
                  <li
                    key={`${line.kind}-${line.cakeId ?? line.productId}`}
                    className="flex justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-1">{line.nameSnapshot}</span>
                      <span className="text-[var(--color-muted-foreground)]"> × {line.quantity}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(line.lineTotalCents)}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(basket.subtotalCents)}</dd>
                </div>
                {basket.deliveryFeeCents > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-muted-foreground)]">Delivery</dt>
                    <dd className="tabular-nums">{formatMoney(basket.deliveryFeeCents)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(basket.totalCents)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">Calculating…</p>
          )}
        </aside>
      </div>
    </div>
  );
}
