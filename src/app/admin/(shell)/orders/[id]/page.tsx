import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guard";
import { findOrderById } from "@/server/repositories/order-repository";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { AdminHeader, StatusBadge } from "@/components/admin/ui";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { publicEnv } from "@/lib/env";
import { statusUpdateMessage, whatsappLink } from "@/lib/whatsapp";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/features/orders/schema";

export const metadata = { title: "Order", robots: { index: false } };

type Params = Promise<{ id: string }>;

/**
 * Order detail.
 *
 * Everything the baker needs in one place: who it is for, how to reach them,
 * what to make, and when. The WhatsApp shortcut is pre-filled with the current
 * status so telling a customer "your cake is ready" is one tap.
 */
async function OrderDetailContent({ params }: { params: Params }) {
  await requireUser();
  const { id } = await params;

  const order = await findOrderById(id);
  if (!order) notFound();

  return (
    <>
      <AdminHeader
        title={order.publicRef}
        subtitle={`Placed ${order.createdAt.toLocaleString("en-ZA", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}`}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
            <StatusBadge status={order.paymentStatus} />
          </div>
        }
      />

      <nav className="mb-6 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/orders" className="hover:text-[var(--color-foreground)]">
          ← All orders
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 font-medium">Customer</h2>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Name</dt>
                <dd className="mt-0.5 font-medium">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Phone</dt>
                <dd className="mt-0.5 font-medium">{formatPhoneDisplay(order.customerPhone)}</dd>
              </div>
              {order.customerEmail ? (
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Email</dt>
                  <dd className="mt-0.5">{order.customerEmail}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Fulfilment</dt>
                <dd className="mt-0.5">
                  {order.fulfilment === "DELIVERY" ? "Delivery" : "Collection"}
                </dd>
              </div>
              {order.deliveryAddress ? (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--color-muted-foreground)]">Address</dt>
                  <dd className="mt-0.5">{order.deliveryAddress}</dd>
                </div>
              ) : null}
              {order.requestedFor ? (
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Needed by</dt>
                  <dd className="mt-0.5 font-medium">
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

            {order.notes ? (
              <div className="mt-4 rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm">
                <p className="font-medium">Customer notes</p>
                <p className="mt-1 whitespace-pre-line text-[var(--color-muted-foreground)]">
                  {order.notes}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={whatsappLink(
                  statusUpdateMessage({ publicRef: order.publicRef, status: order.status }),
                  order.customerPhone,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-[#0b3d20] hover:bg-[#1fbe5a]"
              >
                Update customer on WhatsApp
              </a>
              <a
                href={`tel:${order.customerPhone}`}
                className="rounded-xl border border-[var(--color-border-strong)] px-4 py-2.5 text-sm hover:bg-[var(--color-surface-muted)]"
              >
                Call
              </a>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-medium">Items</h2>

            <ul className="divide-y divide-[var(--color-border)]">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {item.nameSnapshot}
                      <span className="ml-2 font-normal text-[var(--color-muted-foreground)]">
                        × {item.quantity}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {item.kind === "CAKE" ? "Cake" : "Shop item"} ·{" "}
                      {formatMoney(item.unitPriceCents)} each
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums">{formatMoney(item.lineTotalCents)}</span>
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

            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              Pay by {PAYMENT_METHOD_LABELS[order.paymentMethod]?.toLowerCase() ?? order.paymentMethod}.
              Quoted in {publicEnv.currency}.
            </p>
          </Card>
        </div>

        <Card className="p-4 lg:sticky lg:top-24">
          <h2 className="mb-4 font-medium">Manage</h2>

          <OrderStatusForm
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            paymentMethod={order.paymentMethod}
            internalNotes={order.internalNotes}
          />
        </Card>
      </div>
    </>
  );
}

export default function AdminOrderDetailPage(props: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}>
      <OrderDetailContent params={props.params} />
    </Suspense>
  );
}
