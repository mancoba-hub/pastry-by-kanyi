/**
 * Business timezone and wall-clock helpers.
 *
 * Kept in `lib` alongside `money.ts` and `phone.ts` so it can be imported and
 * *validated* by tests without pulling in the Next.js cache machinery.
 */

/**
 * The IANA identifier for South African Standard Time (UTC+2).
 *
 * There is no `Africa/Cape Town`: South Africa has a single time zone and
 * `Africa/Johannesburg` is its canonical IANA name, covering Cape Town and every
 * other city in the country. `Intl` throws `RangeError: Invalid time zone
 * specified` for anything else, which would take out every page that formats a
 * collection date.
 */
export const BUSINESS_TIME_ZONE = "Africa/Johannesburg";

/**
 * Formats a date as a `datetime-local` value in the kitchen's wall-clock time.
 *
 * Built from `formatToParts` rather than `toISOString()`: the ISO form is UTC,
 * so a customer in South Africa would see a time two hours earlier than the one
 * the bakery actually means.
 */
export function toLocalInputValue(date: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  // `en-CA` yields a 24-hour clock, but midnight can surface as "24".
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
