import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guard";
import { getCakeForEdit } from "@/server/services/cake-service";
import { CakeForm } from "@/components/admin/cake-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminHeader, NoticeBanner, StatusBadge } from "@/components/admin/ui";
import { Card } from "@/components/ui";
import {
  archiveCakeAction,
  deleteCakeAction,
  deleteCakeImageAction,
  publishCakeAction,
  updateCakeAction,
} from "@/features/cakes/admin-actions";

export const metadata = { title: "Edit bake", robots: { index: false } };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Edit a bake.
 *
 * Split into two forms on purpose: the details form submits via `useActionState`
 * for inline errors, while the publish/archive/delete controls are plain form
 * actions that post and redirect. Mixing them into one form would mean a status
 * change also re-validating every text field.
 */
async function EditCakeContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const cake = await getCakeForEdit(id);
  if (!cake) notFound();

  const notice = Array.isArray(sp.notice) ? sp.notice[0] : sp.notice;
  const isOwner = user.role === "OWNER";

  return (
    <>
      <AdminHeader
        title={cake.title}
        subtitle={cake.slug}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={cake.status} />
            <Link
              href={`/gallery/${cake.slug}`}
              target="_blank"
              className="rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm hover:bg-[var(--color-surface-muted)]"
            >
              View live ↗
            </Link>
          </div>
        }
      />

      <NoticeBanner notice={notice} />

      {/* Status controls: separate from the details form. */}
      <Card className="mb-8 flex flex-wrap items-center gap-3 p-4">
        <div className="mr-auto">
          <p className="text-sm font-medium">Publishing</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {cake.status === "PUBLISHED"
              ? `Live at /gallery/${cake.slug} since ${
                  cake.publishedAt
                    ? cake.publishedAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
                    : "—"
                }.`
              : cake.status === "DRAFT"
                ? "Not visible to customers yet."
                : "Retired: the link still works but it is out of the gallery."}
          </p>
        </div>

        {cake.status !== "PUBLISHED" ? (
          <form action={publishCakeAction}>
            <input type="hidden" name="cakeId" value={cake.id} />
            <SubmitButton pendingLabel="Publishing…">Publish</SubmitButton>
          </form>
        ) : null}

        {cake.status !== "ARCHIVED" ? (
          <form action={archiveCakeAction}>
            <input type="hidden" name="cakeId" value={cake.id} />
            <SubmitButton
              variant="secondary"
              pendingLabel="Archiving…"
              confirm="Archive this bake? It disappears from the gallery but the link keeps working."
            >
              Archive
            </SubmitButton>
          </form>
        ) : null}

        {isOwner ? (
          <form action={deleteCakeAction}>
            <input type="hidden" name="cakeId" value={cake.id} />
            <SubmitButton
              variant="danger"
              pendingLabel="Deleting…"
              confirm="Permanently delete this bake and all its photos? This cannot be undone."
            >
              Delete
            </SubmitButton>
          </form>
        ) : null}
      </Card>

      <CakeForm
        mode="edit"
        action={updateCakeAction}
        values={{
          id: cake.id,
          title: cake.title,
          description: cake.description,
          flavour: cake.flavour,
          occasion: cake.occasion,
          servings: cake.servings,
          priceCents: cake.priceCents,
          status: cake.status,
          isFeatured: cake.isFeatured,
          bakedAt: cake.bakedAt,
          tags: cake.tags.map((t) => t.label),
        }}
      >
        <div>
          <p className="mb-2 text-sm font-medium">
            Photos <span className="font-normal text-[var(--color-muted-foreground)]">({cake.images.length})</span>
          </p>

          {cake.images.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No photos yet. Add some above; the first becomes the cover.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {cake.images.map((image) => (
                <li key={image.id} className="space-y-2">
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                    <Image
                      src={image.url}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 640px) 33vw, 150px"
                      className="object-cover"
                      placeholder={image.blurDataUrl ? "blur" : "empty"}
                      blurDataURL={image.blurDataUrl ?? undefined}
                    />
                  </div>
                  <form action={deleteCakeImageAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="cakeId" value={cake.id} />
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
          )}
        </div>
      </CakeForm>
    </>
  );
}

export default function EditCakePage(props: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pbk-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]" />}>
      <EditCakeContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
