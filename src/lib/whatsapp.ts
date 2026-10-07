import { publicEnv } from "./env";
import { formatMoney, type Cents } from "./money";

/**
 * WhatsApp deep links.
 *
 * This is the primary conversion path for a South African home baker: the customer
 * taps once, lands in a chat with the order already written out, and the baker
 * keeps the relationship in the app they already use all day. No account, no
 * payment friction.
 */

const BASE = "https://wa.me";

export function whatsappLink(message?: string, phone?: string): string {
  const msisdn = (phone ?? publicEnv.whatsappNumber).replace(/\D/g, "");
  const suffix = message ? `?text=${encodeURIComponent(message)}` : "";

  return msisdn ? `${BASE}/${msisdn}${suffix}` : `${BASE}${suffix}`;
}

export function cakeEnquiryMessage(cake: { title: string; slug: string }): string {
  return [
    `Hi ${publicEnv.siteName}! I'd like to order a cake like *${cake.title}*.`,
    "",
    `Reference: ${publicEnv.siteUrl}/gallery/${cake.slug}`,
    "",
    "Date needed: ",
    "Number of servings: ",
    "Any customisations: ",
  ].join("\n");
}

export function productEnquiryMessage(product: { name: string; priceCents: Cents }): string {
  return [
    `Hi ${publicEnv.siteName}! I'd like to order *${product.name}* (${formatMoney(product.priceCents)}).`,
    "",
    "Quantity: ",
    "Collection or delivery: ",
  ].join("\n");
}

export function orderMessage(order: {
  publicRef: string;
  customerName: string;
  totalCents: Cents;
  fulfilment: "PICKUP" | "DELIVERY";
  items: ReadonlyArray<{ nameSnapshot: string; quantity: number }>;
}): string {
  const lines = [
    `Hi ${publicEnv.siteName}! I've just placed order *${order.publicRef}*.`,
    "",
    `Name: ${order.customerName}`,
    ...order.items.map((i) => `• ${i.quantity} × ${i.nameSnapshot}`),
    "",
    `Total: ${formatMoney(order.totalCents)}`,
    `Fulfilment: ${order.fulfilment === "DELIVERY" ? "Delivery" : "Collection"}`,
  ];

  return lines.join("\n");
}

export function statusUpdateMessage(order: {
  publicRef: string;
  status: string;
}): string {
  return `Order *${order.publicRef}* status: ${order.status.replaceAll("_", " ").toLowerCase()}.`;
}
