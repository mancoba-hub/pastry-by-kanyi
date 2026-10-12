import { z } from "zod";
import { emailSchema, phoneSchema, trimmedString } from "@/lib/validation";

/**
 * Checkout input.
 *
 * Note what is *absent*: prices, line totals and the order total. The client
 * sends identities and quantities only; every amount is resolved server-side
 * from the catalog. A client that can dictate prices can buy a wedding cake for
 * one rand.
 */

export const MAX_LINE_QUANTITY = 20;

export const checkoutLineSchema = z.object({
  kind: z.enum(["CAKE", "PRODUCT"]),
  /** Cake or product id — never a slug, so a rename cannot redirect an order. */
  id: z.string().trim().min(1).max(64),
  quantity: z.coerce
    .number()
    .int("Quantities must be whole numbers.")
    .min(1, "Add at least one.")
    .max(MAX_LINE_QUANTITY, `Maximum ${MAX_LINE_QUANTITY} per item.`),
});

export type CheckoutLine = z.infer<typeof checkoutLineSchema>;

export const checkoutSchema = z
  .object({
    customerName: trimmedString(2, 120, "Name"),
    customerPhone: phoneSchema,
    customerEmail: z.union([emailSchema, z.literal("")]).optional(),
    fulfilment: z.enum(["PICKUP", "DELIVERY"]),
    deliveryAddress: z.string().trim().max(500).optional(),
    /** ISO date or datetime for when the order is needed. */
    requestedFor: z
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
      }),
    notes: z.string().trim().max(1000).optional(),
    items: z.array(checkoutLineSchema).min(1, "Your basket is empty.").max(30),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfilment === "DELIVERY" && !value.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "A delivery address is required for delivery orders.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Minimum lead time between ordering and collection/delivery.
 *
 * A cake is not a stocked item — it gets baked. Without a lead time the site
 * would happily accept an order for a three-tier cake in ten minutes. One week,
 * which is also what the ordering page tells customers.
 */
export const LEAD_TIME_HOURS = 168;

/** Lead time in words, so page copy can never drift from the enforced minimum. */
export function leadTimeLabel(): string {
  if (LEAD_TIME_HOURS % 168 === 0) {
    const weeks = LEAD_TIME_HOURS / 168;
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }

  if (LEAD_TIME_HOURS % 24 === 0) return `${LEAD_TIME_HOURS / 24} days`;

  return `${LEAD_TIME_HOURS} hours`;
}

export function earliestRequestedDate(now = new Date()): Date {
  return new Date(now.getTime() + LEAD_TIME_HOURS * 60 * 60 * 1000);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  BAKING: "In the oven",
  READY: "Ready for collection",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Payment pending",
  PARTIALLY_PAID: "Part-paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: "Cash on collection/delivery",
  MPESA_MANUAL: "M-Pesa",
  BANK_TRANSFER: "Bank transfer",
  GATEWAY: "Card / online",
};
