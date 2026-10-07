import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { AdminHeader, NoticeBanner, StatusBadge, TableWrap, Td, Th } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Bakes", robots: { index: false } };

/**
 * Cake list.
 *
 * Includes drafts and archived bakes, because the point of this screen is
 * "what have I got, and which of it is live". Drafts are the interesting case —
 * a baker uploads from the kitchen, then publishes when the photos are right.
 */
async function CakesList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;

  const cakes = await db.cake.findMany({
    orderBy: [{ bakedAt: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      isFeatured: true,
      bakedAt: true,
      viewCount: true,
      priceCents: true,
      images: {
        select: { url: true, alt: true },
        orderBy: [{ isCover: "desc" }, { position: "asc" }],
        take: 1,
      },
      _count: { select: { images: true } },
    },
  });

  const notice = Array.isArray(sp.notice) ? sp.notice[0] : sp.notice;

  return (
    <>
      <AdminHeader
        title="Bakes"
        subtitle={`${cakes.length} in total`}
        action={
          <Link href="/admin/cakes/new" className={buttonClasses()}>
            + Log a new bake
          </Link>
        }
      />

      <NoticeBanner notice={notice} />

      {cakes.length === 0 ? (
        <p className="text-[var(--color-muted-foreground)]">
          Nothing logged yet.{" "}
          <Link href="/admin/cakes/new" className="text-[var(--color-primary)] hover:underline">
            Log your first bake
          </Link>
          .
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Photo</Th>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Baked</Th>
              <Th className="text-right">Views</Th>
              <Th className="text-right">Price</Th>
            </tr>
          </thead>
          <tbody>
            {cakes.map((cake) => (
              <tr key={cake.id} className="hover:bg-[var(--color-surface-muted)]">
                <Td>
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[var(--color-surface-muted)]">
                    {cake.images[0] ? (
                      <Image src={cake.images[0].url} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[0.6rem] text-[var(--color-muted-foreground)]">
                        none
                      </span>
                    )}
                  </div>
                </Td>

                <Td>
                  <Link
                    href={`/admin/cakes/${cake.id}`}
                    className="font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {cake.title}
                  </Link>
                  <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                    {cake._count.images} photo{cake._count.images === 1 ? "" : "s"}
                    {cake.isFeatured ? " · ★ signature" : ""}
                  </span>
                </Td>

                <Td>
                  <StatusBadge status={cake.status} />
                </Td>

                <Td className="text-[var(--color-muted-foreground)]">
                  {cake.bakedAt.toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Td>

                <Td className="text-right tabular-nums">{cake.viewCount}</Td>

                <Td className="text-right tabular-nums">
                  {cake.priceCents != null ? formatMoney(cake.priceCents) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}

export default function AdminCakesPage(props: PageProps<"/admin/cakes">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}
    >
      <CakesList searchParams={props.searchParams} />
    </Suspense>
  );
}
