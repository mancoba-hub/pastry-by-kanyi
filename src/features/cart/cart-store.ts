/**
 * Cart store.
 *
 * The basket lives in `localStorage`, not on the server, because the customer
 * has no account — requiring a sign-in before adding a cake is the fastest way
 * to lose a mobile customer.
 *
 * This is implemented as an external store consumed through
 * `useSyncExternalStore` rather than `useState` + `useEffect`. That matters for
 * three reasons:
 *
 *   1. The server snapshot is the empty basket, so hydration always matches and
 *      there is no "read localStorage after mount" cascading render.
 *   2. `getSnapshot` is referentially stable across calls (cached by raw string),
 *      which is what `useSyncExternalStore` requires to avoid an infinite loop.
 *   3. Every subscriber sees the same value, and the `storage` event keeps other
 *      tabs in sync for free.
 *
 * Only `{ kind, id, quantity }` are persisted — never prices or names. The
 * server re-prices every line at checkout, so a stale basket cannot show a wrong
 * total after the baker edits the catalog.
 */

export type CartLine = {
  kind: "CAKE" | "PRODUCT";
  id: string;
  quantity: number;
};

const STORAGE_KEY = "pbk.cart.v1";
const MAX_LINES = 30;
const MAX_QUANTITY = 99;

/** Stable identity for the empty basket — `getSnapshot` must not allocate. */
const EMPTY: CartLine[] = [];

let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;
const listeners = new Set<() => void>();

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Partial<CartLine>;

  return (
    (line.kind === "CAKE" || line.kind === "PRODUCT") &&
    typeof line.id === "string" &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0
  );
}

/** localStorage is user-writable, so its contents are treated as untrusted input. */
function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const lines = parsed.filter(isCartLine).slice(0, MAX_LINES);
    return lines.length > 0 ? lines : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing or a restricted context.
    return null;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Fires when another tab writes the same key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = null;
      emit();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Client snapshot. Cached by raw string so repeated calls are stable. */
export function getSnapshot(): CartLine[] {
  const raw = readRaw();

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parse(raw);
  }

  return cachedLines;
}

/** Server snapshot: the basket is unknowable before hydration. */
export function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

function write(lines: CartLine[]): void {
  const next = lines.length > 0 ? lines : EMPTY;

  try {
    if (next.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private browsing: keep the in-memory snapshot correct so the
    // current session still works.
  }

  cachedRaw = null;
  cachedLines = next;
  emit();
}

export const cartActions = {
  add(line: CartLine): void {
    const current = getSnapshot();
    const index = current.findIndex((l) => l.kind === line.kind && l.id === line.id);

    if (index === -1) {
      if (current.length >= MAX_LINES) return;
      write([...current, { ...line, quantity: Math.min(line.quantity, MAX_QUANTITY) }]);
      return;
    }

    const next = [...current];
    next[index] = {
      ...next[index],
      quantity: Math.min(next[index].quantity + line.quantity, MAX_QUANTITY),
    };
    write(next);
  },

  setQuantity(kind: CartLine["kind"], id: string, quantity: number): void {
    const current = getSnapshot();

    if (quantity <= 0) {
      write(current.filter((l) => !(l.kind === kind && l.id === id)));
      return;
    }

    write(
      current.map((l) =>
        l.kind === kind && l.id === id ? { ...l, quantity: Math.min(quantity, MAX_QUANTITY) } : l,
      ),
    );
  },

  remove(kind: CartLine["kind"], id: string): void {
    write(getSnapshot().filter((l) => !(l.kind === kind && l.id === id)));
  },

  clear(): void {
    write([]);
  },
};

/** Serialises the basket into the shape `placeOrder()` expects. */
export function toOrderItems(lines: readonly CartLine[]) {
  return lines.map((line) => ({ kind: line.kind, id: line.id, quantity: line.quantity }));
}
