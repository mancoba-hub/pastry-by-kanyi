"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/features/cart/use-cart";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Add-to-basket control.
 *
 * Optimistic by nature (localStorage write is instant), so the confirmation is
 * immediate and the basket total in the header updates without a round trip.
 */
export function AddToCart({
  kind,
  id,
  maxQuantity = 20,
  disabled = false,
  className,
  label = "Add to basket",
}: {
  kind: "CAKE" | "PRODUCT";
  id: string;
  maxQuantity?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(() => {
      add({ kind, id, quantity });
      setAdded(true);
    });

    window.setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-1">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1 || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium hover:bg-[var(--color-surface-muted)] disabled:opacity-40"
          aria-label="Reduce quantity"
        >
          −
        </button>
        <span className="w-10 text-center text-base font-medium tabular-nums" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          disabled={quantity >= maxQuantity || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium hover:bg-[var(--color-surface-muted)] disabled:opacity-40"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className={buttonClasses({ size: "md", className: "flex-1" })}
      >
        {added ? "Added ✓" : label}
      </button>
    </div>
  );
}
