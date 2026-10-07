"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  cartActions,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type CartLine,
} from "./cart-store";

export { toOrderItems, type CartLine } from "./cart-store";

/**
 * Reads the basket.
 *
 * No provider and no context: `useSyncExternalStore` already gives every
 * component the same value, and a context provider would add a re-render for
 * every consumer on every change for no benefit.
 *
 * `getServerSnapshot` returns the empty basket, so the server-rendered markup
 * and the first client render agree. `ready` flips to true once hydrated, which
 * is what pages use to avoid showing "your basket is empty" before the stored
 * basket has been read.
 */
export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();

  return useMemo(
    () => ({
      lines,
      ready: hydrated,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      add: cartActions.add,
      setQuantity: cartActions.setQuantity,
      remove: cartActions.remove,
      clear: cartActions.clear,
    }),
    [lines, hydrated],
  );
}

/**
 * `false` during server rendering and the hydration pass, `true` afterwards.
 *
 * Implemented as a store read rather than `useState` + `useEffect` so it does
 * not trigger a cascading render on mount.
 */
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerHydrationSnapshot);
}

export type { CartLine as CartLineType };
