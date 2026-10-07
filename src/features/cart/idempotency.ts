/**
 * Basket idempotency.
 *
 * Kept in its own module (no React, no client directive) because it is pure
 * logic that both the checkout form and the tests need.
 *
 * Derived from the basket contents rather than random, so retrying the *same*
 * basket reuses the key and the server returns the original order instead of
 * creating a second one. Change the basket and the key changes — which is
 * correct, because that is genuinely a different order.
 */
export function basketIdempotencyKey(
  lines: readonly { kind: string; id: string; quantity: number }[],
): string {
  const canonical = [...lines]
    .map((line) => `${line.kind}:${line.id}:${line.quantity}`)
    // Sorted, so reordering the basket does not mint a new key.
    .sort()
    .join("|");

  // FNV-1a: short, stable, dependency-free. Not security-sensitive — it only
  // needs to be collision-resistant within one customer's baskets.
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return `basket-${(hash >>> 0).toString(36)}-${canonical.length}`;
}
