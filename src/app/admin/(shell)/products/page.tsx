import { Suspense } from "react";
import Image from "next/image";
import { requireUser } from "@/server/auth/guard";
import { getAdminProducts } from "@/server/services/product-service";
import { ProductForm } from "@/components/admin/product-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminHeader, NoticeBanner, StatusBadge } from "@/components/admin/ui";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import {
  createProductAction,
  deleteProductAction,
  deleteProductImageAction,
  updateProductAction,
} from "@/features/products/admin-actions";

export const metadata = { title: "Shop", robots: { index: false } };

/**
 * Shop management.
 *
 * Each product is an expandable `<details>` block containing its own edit form.
 * That keeps the whole thing on one screen — a baker updating "sold out" between
 * customers should not have to navigate anywhere — and it works without any
 * client-side routing.
 */
async function ProductsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const products = await getAdminProducts();
  const notice = Array.isArray(sp.notice) ? sp.notice[0] : sp.notice;
  const isOwner = user.role === "OWNER";

  return (
    <>
      <AdminHeader title="Shop" subtitle={`${products.length} item(s)`} />

      <NoticeBanner notice={notice} />

      <details className="mb-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <summary className="cursor-pointer font-medium">+ Add a product</summary>
        <div className="mt-5">
          <ProductForm mode="create" action={createProductAction} />
        </div>
      </details>

      {products.length === 0 ? (
        <p className="text-[var(--color-muted-foreground)]">
          Nothing in the shop yet. Add your first product above.
        </p>
      ) : (
        <ul className="space-y-4">
          {products.map((product) => (
            <li key={product.id}>
              <details className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-muted)]">
                    {product.images[0] ? (
                      <Image src={product.images[0].url} alt="" fill sizes="48px" className="object-cover" />
                    ) : null}
                  </div>

                  <div className="mr-auto min-w-0">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {formatMoney(product.priceCents)} · {product.unitLabel}
                      {product.stockQty !== null ? ` · ${product.stockQty} in stock` : " · unlimited"}
                    </p>
                  </div>

                  <StatusBadge status={product.status} />
                </summary>

                <div className="border-t border-[var(--color-border)] p-4">
                  <ProductForm
                    mode="edit"
                    action={updateProductAction}
                    values={{
                      id: product.id,
                      name: product.name,
                      description: product.description,
                      priceCents: product.priceCents,
                      unitLabel: product.unitLabel,
                      status: product.status,
                      isFeatured: product.isFeatured,
                      stockQty: product.stockQty,
                      maxPerOrder: product.maxPerOrder,
                    }}
                  />

                  {product.images.length > 0 ? (
                    <div className="mt-6">
                      <p className="mb-2 text-sm font-medium">Photos</p>
                      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                        {product.images.map((image) => (
                          <li key={image.id} className="space-y-2">
                            <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border)]">
                              <Image src={image.url} alt={image.alt} fill sizes="120px" className="object-cover" />
                            </div>
                            <form action={deleteProductImageAction}>
                              <input type="hidden" name="imageId" value={image.id} />
                              <SubmitButton
                                variant="ghost"
                                size="sm"
                                pendingLabel="…"
                                className="w-full"
                                confirm="Remove this photo?"
                              >
                                Remove
                              </SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {isOwner ? (
                    <Card className="mt-6 flex flex-wrap items-center gap-3 border-[var(--color-danger)] p-4">
                      <p className="mr-auto text-sm text-[var(--color-muted-foreground)]">
                        Deleting removes the product and its photos for good.
                      </p>
                      <form action={deleteProductAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <SubmitButton
                          variant="danger"
                          pendingLabel="Deleting…"
                          confirm={`Permanently delete "${product.name}"? This cannot be undone.`}
                        >
                          Delete product
                        </SubmitButton>
                      </form>
                    </Card>
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminProductsPage(props: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}>
      <ProductsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
