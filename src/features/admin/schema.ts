import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";
import { trimmedString } from "@/lib/validation";

/**
 * Admin form schemas.
 *
 * FormData is a flat bag of strings, so every field is parsed from a string and
 * normalised here. This is the only place that knows how to turn a `<form>` into
 * domain input, which keeps the Server Actions thin.
 */

/** Shared shape returned to `useActionState`. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string[]>;
};

export const EMPTY_ACTION_STATE: ActionState = {};

/** "" or an unparseable value both mean "not set" rather than an error. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? null : (value ?? null)));

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;

    const cents = parseMoneyToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price like 8500 or 8,500." });
      return z.NEVER;
    }
    if (cents < 0) {
      ctx.addIssue({ code: "custom", message: "Price cannot be negative." });
      return z.NEVER;
    }
    return cents;
  });

const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;

      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}.` });
        return z.NEVER;
      }
      return parsed;
    });

/** `datetime-local` or `date` input. Falls back to now when blank. */
const bakedAtField = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return new Date();

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

const tagListField = z
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

export const cakeFormSchema = z.object({
  title: trimmedString(3, 120, "Title"),
  description: trimmedString(10, 2000, "Description"),
  flavour: optionalText(120),
  occasion: optionalText(80),
  servings: optionalInt(1, 500, "Servings"),
  priceCents: optionalMoney,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  isFeatured: z.boolean(),
  bakedAt: bakedAtField,
  tags: tagListField,
});

export type CakeFormInput = z.infer<typeof cakeFormSchema>;

/**
 * Parses the cake form plus its image inputs.
 *
 * Files arrive as `File` entries; browsers submit an empty `File` for an
 * untouched file input, so those are filtered out rather than treated as
 * zero-byte uploads.
 */
export function parseCakeForm(formData: FormData) {
  const parsed = cakeFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    flavour: formData.get("flavour") ?? "",
    occasion: formData.get("occasion") ?? "",
    servings: formData.get("servings") ?? "",
    priceCents: formData.get("price") ?? "",
    status: formData.get("status") ?? "DRAFT",
    isFeatured: formData.get("isFeatured") === "on" || formData.get("isFeatured") === "true",
    bakedAt: formData.get("bakedAt") ?? "",
    tags: formData.get("tags") ?? "",
  });

  const images = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  return { parsed, images };
}

export const productFormSchema = z.object({
  name: trimmedString(3, 120, "Name"),
  description: trimmedString(10, 1000, "Description"),
  priceCents: z
    .string()
    .trim()
    .min(1, "Enter a price.")
    .transform((value, ctx) => {
      const cents = parseMoneyToCents(value);
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: "Enter a price like 450 or 450.50." });
        return z.NEVER;
      }
      return cents;
    }),
  unitLabel: trimmedString(1, 40, "Unit"),
  status: z.enum(["DRAFT", "ACTIVE", "SOLD_OUT", "ARCHIVED"]),
  isFeatured: z.boolean(),
  stockQty: optionalInt(0, 10_000, "Stock"),
  maxPerOrder: z.coerce.number().int().min(1).max(100),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

export function parseProductForm(formData: FormData) {
  const parsed = productFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    priceCents: formData.get("price") ?? "",
    unitLabel: formData.get("unitLabel") ?? "each",
    status: formData.get("status") ?? "DRAFT",
    isFeatured: formData.get("isFeatured") === "on" || formData.get("isFeatured") === "true",
    stockQty: formData.get("stockQty") ?? "",
    maxPerOrder: formData.get("maxPerOrder") ?? 10,
  });

  const images = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  return { parsed, images };
}

export const orderUpdateFormSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "BAKING",
    "READY",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ]),
  paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"]),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "MPESA_MANUAL", "BANK_TRANSFER", "GATEWAY"]),
  internalNotes: z.string().trim().max(2000).optional(),
});

export function zodFields(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}
