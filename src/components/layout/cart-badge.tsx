"use client";

import { useCart } from "@/features/cart/use-cart";

/** Cart count for the header. Renders nothing until the basket is loaded. */
export function CartBadge() {
  const { itemCount, ready } = useCart();

  if (!ready || itemCount === 0) return null;

  return (
    <span
      className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.65rem] font-semibold text-[var(--color-primary-foreground)]"
      aria-hidden="true"
    >
      {itemCount > 99 ? "99+" : itemCount}
    </span>
  );
}
