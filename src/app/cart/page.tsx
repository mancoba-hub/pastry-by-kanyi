"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/features/cart/use-cart";
import { usePricedBasket } from "@/features/cart/use-priced-basket";
import { buttonClasses, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";

/**
 * Basket page.
 *
 * A Client Component by necessity: the basket lives in localStorage, so only the
 * browser knows what is in it. Prices and availability come from the server via
 * `usePricedBasket`, which runs the same pricing code as checkout.
 */
export default function CartPage() {
  const { lines, ready, setQuantity, remove, clear } = useCart();
  const { basket, loading, error, problems } = usePricedBasket("PICKUP");

  if (!ready) {
    return <CartSkeleton />;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-14">
        <h1 className="mb-8 text-3xl font-semibold">Your basket</h1>
        <EmptyState
          title="Your basket is empty"
          description="Browse the gallery or the shop and add something you like."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/gallery" className={buttonClasses()}>
                Browse cakes
              </Link>
              <Link href="/shop" className={buttonClasses({ variant: "secondary" })}>
                Shop scones
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Your basket</h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          Clear basket
        </button>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-xl border border-[var(--color-danger)] bg-[#fdeceb] px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-[var(--color-danger)]">{error}</p>
          {problems.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--color-muted-foreground)]">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-3">
        {lines.map((line) => {
          const priced = basket?.lines.find((l) =>
            line.kind === "CAKE" ? l.cakeId === line.id : l.productId === line.id,
          );

          return (
            <li
              key={`${line.kind}-${line.id}`}
              className="flex gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-muted)]">
                {priced?.imageUrl ? (
                  <Image src={priced.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{priced?.nameSnapshot ?? "Loading…"}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {line.kind === "CAKE" ? "Cake" : "Shop item"}
                      {priced ? ` · ${formatMoney(priced.unitPriceCents)} each` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.kind, line.id)}
                    className="shrink-0 text-xs text-[var(--color-muted-foreground)] underline underline-offset-4 hover:text-[var(--color-danger)]"
                    aria-label={`Remove ${priced?.nameSnapshot ?? "item"}`}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border-strong)]">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.kind, line.id, line.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center hover:bg-[var(--color-surface-muted)]"
                      aria-label="Reduce quantity"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.kind, line.id, line.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center hover:bg-[var(--color-surface-muted)]"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-semibold tabular-nums">
                    {priced ? formatMoney(priced.lineTotalCents) : "—"}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted-foreground)]">Subtotal</span>
          <span className="tabular-nums">
            {basket ? formatMoney(basket.subtotalCents) : loading ? "Calculating…" : "—"}
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          Delivery, if you need it, is calculated at checkout.
        </p>

        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
          <span className="font-medium">Total</span>
          <span className="text-xl font-semibold tabular-nums">
            {basket ? formatMoney(basket.totalCents) : "—"}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/checkout" className={buttonClasses({ size: "lg", className: "flex-1" })}>
          Continue to checkout
        </Link>
        <Link
          href="/gallery"
          className={buttonClasses({ variant: "secondary", size: "lg" })}
        >
          Keep browsing
        </Link>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6 h-9 w-48 animate-pbk-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
          />
        ))}
      </div>
    </div>
  );
}
