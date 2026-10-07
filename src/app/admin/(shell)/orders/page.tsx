import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { AdminHeader, StatusBadge, TableWrap, Td, Th } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { ORDER_STATUS_LABELS } from "@/features/orders/schema";

export const metadata = { title: "Orders", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "New" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "BAKING", label: "Baking" },
  { value: "READY", label: "Ready" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

/** Orders list with a status filter and a reference/name/phone search. */

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function OrdersContent({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;

  const statusParam = firstValue(sp.status);
  const search = firstValue(sp.q)?.trim();

  const validStatus = FILTERS.some((f) => f.value === statusParam && f.value !== "")
    ? (statusParam as string)
    : undefined;

  const orders = await db.order.findMany({
    where: {
      ...(validStatus ? { status: validStatus as never } : {}),
      ...(search
        ? {
            OR: [
              { publicRef: { contains: search, mode: "insensitive" } },
              { customerName: { contains: search, mode: "insensitive" } },
              { customerPhone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      publicRef: true,
      customerName: true,
      customerPhone: true,
      status: true,
      paymentStatus: true,
      fulfilment: true,
      totalCents: true,
      requestedFor: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <>
      <AdminHeader title="Orders" subtitle={`${orders.length} shown`} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = (validStatus ?? "") === filter.value;
          const params = new URLSearchParams();
          if (filter.value) params.set("status", filter.value);
          if (search) params.set("q", search);
          const query = params.toString();

          return (
            <Link
              key={filter.value || "all"}
              href={query ? `/admin/orders?${query}` : "/admin/orders"}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {/* GET form: search state lives in the URL, so it is shareable and
          survives a refresh. */}
      <form method="get" className="mb-5 flex max-w-md gap-2">
        {validStatus ? <input type="hidden" name="status" value={validStatus} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Reference, name or phone"
          className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-sm"
          aria-label="Search orders"
        />
        <button type="submit" className={buttonClasses({ variant: "secondary", size: "md" })}>
          Search
        </button>
      </form>

      {orders.length === 0 ? (
        <p className="text-[var(--color-muted-foreground)]">No orders match.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Customer</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th>Placed</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-[var(--color-surface-muted)]">
                <Td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {order.publicRef}
                  </Link>
                  <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                    {order._count.items} item(s) · {order.fulfilment === "DELIVERY" ? "delivery" : "collection"}
                  </span>
                </Td>

                <Td>
                  <span className="block">{order.customerName}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {formatPhoneDisplay(order.customerPhone)}
                  </span>
                </Td>

                <Td>
                  <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
                </Td>

                <Td>
                  <StatusBadge status={order.paymentStatus} />
                </Td>

                <Td className="text-[var(--color-muted-foreground)]">
                  {order.createdAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </Td>

                <Td className="text-right tabular-nums">{formatMoney(order.totalCents)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}

export default function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}>
      <OrdersContent searchParams={props.searchParams} />
    </Suspense>
  );
}
