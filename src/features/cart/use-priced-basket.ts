"use client";

import { useCallback, useEffect, useState } from "react";
import { useCart, toOrderItems } from "./use-cart";

/**
 * Server-authoritative basket pricing.
 *
 * The browser holds only `{ kind, id, quantity }`. Names, availability and
 * prices come from `/api/v1/cart`, which runs the identical pricing code path
 * that creates the order — so the basket total can never disagree with what the
 * customer is actually charged.
 */

export type PricedLine = {
  kind: "CAKE" | "PRODUCT";
  cakeId: string | null;
  productId: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  slug: string;
  imageUrl: string | null;
};

export type PricedBasket = {
  lines: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
};

type BasketState = {
  basket: PricedBasket | null;
  loading: boolean;
  error: string | null;
  /** Lines the server rejected (unavailable, sold out, unlisted). */
  problems: string[];
  refresh: () => void;
};

/** Stable identity for an empty basket, so consumers do not re-render needlessly. */
const EMPTY_BASKET: PricedBasket = {
  lines: [],
  subtotalCents: 0,
  deliveryFeeCents: 0,
  totalCents: 0,
};

export function usePricedBasket(fulfilment: "PICKUP" | "DELIVERY" = "PICKUP"): BasketState {
  const { lines, ready } = useCart();

  const [fetched, setFetched] = useState<PricedBasket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const isEmpty = lines.length === 0;

  // A stable representation of the basket, so the effect does not re-fire on
  // every render just because a new array identity was created.
  const serialised = JSON.stringify(toOrderItems(lines));

  useEffect(() => {
    // Nothing to price. Handled by derivation below rather than by setting
    // state here, which would cause a cascading render on every mount.
    if (!ready || isEmpty) return;

    const controller = new AbortController();

    // All state updates live inside this async function, so the effect body
    // itself stays free of synchronous updates.
    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/cart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: JSON.parse(serialised), fulfilment }),
          signal: controller.signal,
        });

        const payload = await response.json();

        if (!response.ok) {
          setError(payload?.error?.message ?? "We could not price your basket.");
          setProblems((Object.values(payload?.error?.fields ?? {}).flat() as string[]) ?? []);
          setFetched(null);
          return;
        }

        setFetched(payload.data as PricedBasket);
        setProblems([]);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("We could not reach the kitchen. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [serialised, ready, fulfilment, nonce, isEmpty]);

  // An empty basket is answered from a constant rather than being written into
  // state, which keeps stale errors from a previous basket off the screen.
  if (isEmpty) {
    return { basket: EMPTY_BASKET, loading: false, error: null, problems: [], refresh };
  }

  return { basket: fetched, loading, error, problems, refresh };
}
