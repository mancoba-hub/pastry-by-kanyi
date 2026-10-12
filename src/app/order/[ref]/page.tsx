import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import thankYou from "@/images/thank-you.jpg";
import { getOrderByRef } from "@/server/services/order-service";
import { Badge, buttonClasses } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/features/orders/schema";

/**
 * Order status page.
 *
 * Reached right after checkout and revisitable from the emailed/WhatsApped link.
 * Marked noindex: the URL contains the order reference, which is effectively a
 * bearer token for that order and must not end up in a search index.
 */

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

const STATUS_ORDER = [
  "PENDING",
  "CONFIRMED",
  "BAKING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
] as const;

function statusTone(status: string) {
  if (status === "CANCELLED") return "danger" as const;
  if (status === "COMPLETED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  return "primary" as const;
}

async function OrderView({ publicRef, placed }: { publicRef: string; placed: boolean }) {
  const order = await getOrderByRef(publicRef);
  if (!order) notFound();

  const cancelled = order.status === "CANCELLED";
  const timeline = STATUS_ORDER.filter(
    (status) => order.fulfilment === "DELIVERY" || status !== "OUT_FOR_DELIVERY",
  );
  const currentIndex = timeline.indexOf(order.status as (typeof timeline)[number]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      {placed ? (
        <div className="mb-6 rounded-[var(--radius-card)] border border-[var(--color-success)] bg-[#e6f2ea] p-4">
          <Image
            src={thankYou}
            alt="Thank you for your order"
            sizes="(min-width: 704px) 640px, calc(100vw - 64px)"
            className="mb-4 h-auto w-full rounded-[var(--radius-card)]"
          />
          <p className="font-medium text-[var(--color-success)]">Order received, thank you!</p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Send it to us on WhatsApp so we can confirm the details and start baking.
          </p>
          <a
            href={whatsappLink(
              `Hi ${publicEnv.siteName}! I've just placed order ${order.publicRef}.`,
              publicEnv.whatsappNumber,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "whatsapp", size: "md", className: "mt-3" })}
          >
            Send order on WhatsApp
          </a>
        </div>
      ) : null}

      <header className="mb-6">
        <p className="text-sm text-[var(--color-muted-foreground)]">Order reference</p>
        <h1 className="text-3xl font-semibold tracking-tight">{order.publicRef}</h1>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={statusTone(order.status)}>
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </Badge>
          <Badge tone={order.paymentStatus === "PAID" ? "success" : "neutral"}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </Badge>
          <Badge tone="neutral">
            {order.fulfilment === "DELIVERY" ? "Delivery" : "Collection"}
          </Badge>
        </div>
      </header>

      {!cancelled ? (
        <ol className="mb-8 space-y-0">
          {timeline.map((status, index) => {
            const done = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li key={status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      done ? "bg-[var(--color-primary)]" : "bg-[var(--color-border-strong)]"
                    }`}
                    aria-hidden="true"
                  />
                  {index < timeline.length - 1 ? (
                    <span
                      className={`w-px flex-1 ${done ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                <div className="pb-6">
                  <p className={isCurrent ? "font-medium" : "text-[var(--color-muted-foreground)]"}>
                    {ORDER_STATUS_LABELS[status]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 font-medium">What you ordered</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.nameSnapshot}
                <span className="text-[var(--color-muted-foreground)]"> × {item.quantity}</span>
              </span>
              <span className="tabular-nums">{formatMoney(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted-foreground)]">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotalCents)}</dd>
          </div>
          {order.deliveryFeeCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">Delivery</dt>
              <dd className="tabular-nums">{formatMoney(order.deliveryFeeCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-muted-foreground)]">Placed</dt>
          <dd className="mt-0.5">
            {order.createdAt.toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </dd>
        </div>
        {order.requestedFor ? (
          <div>
            <dt className="text-[var(--color-muted-foreground)]">Needed by</dt>
            <dd className="mt-0.5">
              {order.requestedFor.toLocaleString("en-ZA", {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={whatsappLink(
            `Hi ${publicEnv.siteName}! A question about order ${order.publicRef}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: "whatsapp" })}
        >
          Ask about this order
        </a>
        <Link href="/gallery" className={buttonClasses({ variant: "secondary" })}>
          Back to the gallery
        </Link>
      </div>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/order/[ref]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-2xl px-4 py-10">
          <div className="mb-6 h-10 w-56 animate-pbk-pulse rounded bg-[var(--color-surface-muted)]" />
          <div className="h-64 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />
        </div>
      }
    >
      <OrderSlot params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function OrderSlot({
  params,
  searchParams,
}: {
  params: PageProps<"/order/[ref]">["params"];
  searchParams: PageProps<"/order/[ref]">["searchParams"];
}) {
  // An order page is per-order and must never be prerendered. `connection()`
  // is the Cache Components primitive that says "wait for a real request" —
  // without it Next.js tries to render this route at build time with a
  // placeholder reference, which hits notFound() and fails the build.
  await connection();

  const [routeParams, sp] = await Promise.all([params, searchParams]);

  // Named `publicRef` rather than `ref`: `ref` is a reserved-ish React concept
  // and shadowing it in a component render confuses both readers and lint rules.
  return <OrderView publicRef={routeParams.ref} placed={sp.placed === "1"} />;
}
