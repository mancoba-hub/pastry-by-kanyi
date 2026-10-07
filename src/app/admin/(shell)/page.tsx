import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import { getOrderStats, getOpenOrders } from "@/server/services/order-service";
import { countPublishedCakes } from "@/server/repositories/cake-repository";
import { getAdminProducts } from "@/server/services/product-service";
import { AdminHeader, NoticeBanner, StatCard, StatusBadge, TableWrap, Td, Th } from "@/components/admin/ui";
import { buttonClasses, Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/features/orders/schema";
import { formatPhoneDisplay } from "@/lib/phone";

export const metadata = { title: "Dashboard", robots: { index: false } };

/**
 * Dashboard.
 *
 * Answers the two questions a baker actually opens this for: "what do I need to
 * bake next?" and "what's new since I last looked?" — in that order.
 */
async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const [stats, openOrders, publishedCakes, products] = await Promise.all([
    getOrderStats(),
    getOpenOrders(8),
    countPublishedCakes(),
    getAdminProducts(),
  ]);

  const notice = Array.isArray(sp.notice) ? sp.notice[0] : sp.notice;

  return (
    <>
      <AdminHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        subtitle="Here's what needs your attention."
        action={
          <Link href="/admin/cakes/new" className={buttonClasses()}>
            + Log a new bake
          </Link>
        }
      />

      <NoticeBanner notice={notice} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="New orders"
          value={stats.pending}
          hint="Awaiting confirmation"
          href="/admin/orders?status=PENDING"
        />
        <StatCard
          label="In the works"
          value={stats.inProgress}
          hint="Confirmed through delivery"
          href="/admin/orders"
        />
        <StatCard label="Bakes published" value={publishedCakes} href="/admin/cakes" />
        <StatCard label="Shop items" value={products.length} href="/admin/products" />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Orders needing attention</h2>

        {openOrders.length === 0 ? (
          <EmptyState
            title="Nothing outstanding"
            description="Every order is completed or cancelled. Enjoy the quiet."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Needed</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[var(--color-surface-muted)]">
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {order.publicRef}
                    </Link>
                  </Td>
                  <Td>
                    <span className="block">{order.customerName}</span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {formatPhoneDisplay(order.customerPhone)}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge
                      status={order.status}
                      label={ORDER_STATUS_LABELS[order.status] ?? order.status}
                    />
                  </Td>
                  <Td className="text-[var(--color-muted-foreground)]">
                    {order.requestedFor
                      ? order.requestedFor.toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(order.totalCents)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <h3 className="font-medium">Log a bake</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Upload photos and details straight from your phone.
          </p>
          <Link href="/admin/cakes/new" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3" })}>
            Add cake
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium">Update the shop</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Mark scones sold out, or change a price.
          </p>
          <Link href="/admin/products" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3" })}>
            Manage shop
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium">All orders</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {stats.completed} completed · {stats.cancelled} cancelled
          </p>
          <Link href="/admin/orders" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3" })}>
            View orders
          </Link>
        </Card>
      </section>
    </>
  );
}

export default function AdminDashboardPage(props: PageProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pbk-pulse rounded bg-[var(--color-surface-muted)]" />
          <div className="h-28 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />
        </div>
      }
    >
      <DashboardContent searchParams={props.searchParams} />
    </Suspense>
  );
}
