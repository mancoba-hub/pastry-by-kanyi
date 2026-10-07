import { publicEnv } from "./env";

/**
 * Money is always an integer count of minor units (cents) in the store.
 * Never use floats — 0.1 + 0.2 !== 0.3 and a bakery's books must reconcile.
 *
 * South African Rand is divided into 100 cents, so `priceCents` is literal here
 * rather than a generic "minor units" euphemism.
 */

export type Cents = number;

/**
 * Formats cents as Rand for display.
 *
 * Uses the `en-ZA` locale, which renders ZAR the way South Africans write it:
 * `R 7 800` — an "R" prefix and a space as the thousands separator, rather than
 * the `ZAR 7,800` a British or American locale would produce.
 */
export function formatMoney(cents: Cents, opts?: { currency?: string; compact?: boolean }): string {
  const currency = opts?.currency ?? publicEnv.currency;
  const amount = cents / 100;

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    // Whole rand is the norm for a cake price; show cents only when they exist.
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
    notation: opts?.compact ? "compact" : "standard",
  }).format(amount);
}

/**
 * Parses user input like "7 800", "7800", "R 1,500.50" or "R7800" into cents.
 *
 * Deliberately tolerant of both separators: South Africans write "R 7 800" while
 * an international keyboard produces "7,800", and a baker typing a price should
 * not have to think about which the app prefers.
 */
export function parseMoneyToCents(input: string): Cents | null {
  const cleaned = input.replace(/[^\d.,-]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;

  let normalised = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the later one is the decimal separator ("1,500.50" or "1.500,50").
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";

    normalised = cleaned.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") normalised = normalised.replace(",", ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const separator = lastComma !== -1 ? "," : ".";
    const parts = cleaned.split(separator);

    // A single separator followed by exactly three digits is grouping ("7,800"),
    // not a decimal point.
    const isGrouping = parts.length === 2 && parts[1].length === 3;

    normalised = isGrouping ? parts.join("") : parts.join(".");
  }

  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value)) return null;

  // Round rather than truncate, so 10.005 does not silently become 10.00.
  return Math.round(value * 100);
}

/** Rounds to whole rand. ZAR prices are rarely quoted in cents. */
export function roundToWholeRand(cents: Cents): Cents {
  return Math.round(cents / 100) * 100;
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
