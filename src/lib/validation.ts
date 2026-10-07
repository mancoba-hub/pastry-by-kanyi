import { z } from "zod";
import { normaliseSouthAfricanPhone } from "./phone";

/**
 * Shared Zod primitives.
 *
 * Every value that crosses a trust boundary — HTTP body, query string, form
 * submission, upload metadata — is parsed here before it reaches a service.
 * Schemas are the single source of truth for both runtime validation and
 * TypeScript types (`z.infer`), so the two can never drift.
 */

export const slugSchema = z
  .string()
  .trim()
  .min(1, "A slug is required.")
  .max(80, "Slugs must be 80 characters or fewer.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");

/** South African mobile, normalised to E.164. Accepts any common local format. */
export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Enter a phone number.")
  .transform((value, ctx) => {
    const normalised = normaliseSouthAfricanPhone(value);
    if (!normalised) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid South African mobile number, e.g. 082 123 4567.",
      });
      return z.NEVER;
    }
    return normalised;
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/** Cents, as a non-negative integer. Rejects floats and negative prices. */
export const moneyCentsSchema = z
  .number()
  .int("Amounts must be whole cents.")
  .min(0, "Amount cannot be negative.")
  .max(100_000_000, "That amount looks wrong.");

export const trimmedString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const altTextSchema = trimmedString(3, 180, "Image description");

/**
 * Cursor pagination.
 *
 * Offset pagination degrades linearly (`OFFSET 100000` still scans 100000 rows)
 * and duplicates rows when the gallery is being reordered mid-scroll — which is
 * exactly what happens when a baker uploads while someone is browsing. Keyset
 * pagination is stable and index-friendly, so it is the only form offered.
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).default(12),
  cursor: z.string().max(200).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export type Cursor = { bakedAt: string; id: string };

export function encodeCursor(value: Cursor): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cursor).bakedAt === "string" &&
      typeof (parsed as Cursor).id === "string" &&
      !Number.isNaN(Date.parse((parsed as Cursor).bakedAt))
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    // A malformed cursor is treated as "start from the beginning" rather than a
    // 400: a user with a stale bookmark should still see the gallery.
    return null;
  }
}

/** `<input type="date">` value, or null when blank. */
export const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

/** Space/comma separated labels -> deduplicated, slug-normalised array. */
export const tagsInputSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(/[,\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 10),
  );

/** Flattens an issue list into a single human-readable message. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That value is not valid.";
}
