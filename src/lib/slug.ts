/**
 * URL slug helpers.
 *
 * Gallery URLs are shared on WhatsApp and Instagram, so slugs stay short,
 * lowercase and ASCII-only. Anything non-ASCII is transliterated or dropped
 * rather than percent-encoded, which keeps links readable and copy-pasteable.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Appends a short suffix only when needed, so the first cake called
 * "Chocolate Drip" keeps the clean slug `chocolate-drip`.
 */
export function uniqueSlug(base: string, isTaken: (candidate: string) => boolean): string {
  const root = slugify(base) || "untitled";
  if (!isTaken(root)) return root;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!isTaken(candidate)) return candidate;
  }

  return `${root}-${Date.now().toString(36)}`;
}

/** Normalises a tag label into its canonical facet slug. */
export const tagSlug = (label: string): string => slugify(label);
