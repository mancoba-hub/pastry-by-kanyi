import { cacheLife } from "next/cache";
import { LEAD_TIME_HOURS } from "@/features/orders/schema";
import { toLocalInputValue } from "@/lib/datetime";

/**
 * Clock-dependent values, cached.
 *
 * Under Cache Components, reading `new Date()` during a render is an "unstable
 * value": it makes a prerendered page non-deterministic, and Next.js fails the
 * build rather than ship a stale timestamp silently.
 *
 * Wrapping them in `'use cache'` with an explicit lifetime is the sanctioned
 * fix — the value is computed once, snapshotted, and refreshed on schedule.
 */

/** Copyright year for the footer. Changes at most annually. */
export async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife("weeks");

  return new Date().getFullYear();
}

/**
 * A human date for the home page. Deliberately short-lived: it is a freshness
 * cue ("Fresh today · Wednesday 8 October"), so being a few minutes stale is
 * fine but being a day stale is not.
 */
export async function getTodayLabel(): Promise<string> {
  "use cache";
  cacheLife("minutes");

  return new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Earliest date the kitchen can commit to, as a `datetime-local` input value.
 *
 * Computed on the server and cached, which is what lets the `min` and
 * `defaultValue` attributes ship in the initial HTML instead of appearing after
 * hydration. The server re-validates the lead time at checkout regardless, so
 * this is a usability hint, not the enforcement point.
 */
export async function getEarliestCollectionLocal(): Promise<string> {
  "use cache";
  // Short-lived: the hint shifts by a minute, and nobody notices a minute.
  cacheLife("minutes");

  return toLocalInputValue(new Date(Date.now() + LEAD_TIME_HOURS * 60 * 60 * 1000));
}
