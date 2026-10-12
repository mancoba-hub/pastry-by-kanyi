"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/server/auth/guard";
import { checkAdminRateLimit } from "@/server/admin/rate-limit";
import {
  archiveCake,
  createCake,
  deleteCake,
  publishCake,
  updateCake,
} from "@/server/services/cake-service";
import { deleteImage, uploadImage, UploadError } from "@/server/services/upload-service";
import { logger } from "@/lib/logger";
import { parseCakeForm, zodFields, type ActionState } from "@/features/admin/schema";

/**
 * Cake admin actions.
 *
 * Every action starts with `requireUserOrThrow("ADMIN")`. That is the real
 * authorisation boundary — `proxy.ts` only does a cheap cookie-presence check so
 * anonymous visitors are redirected before rendering.
 *
 * Note the ordering on create: the cake row is written first, then images. If an
 * image fails, the baker still has their draft and can re-upload, rather than
 * losing the whole entry.
 *
 * A `"use server"` module may only export async functions, so shared types and
 * constants live in `@/features/admin/schema` rather than being re-exported here.
 */

function failure(message: string, fields?: Record<string, string[]>): ActionState {
  return { ok: false, message, ...(fields ? { fields } : {}) };
}

/** Revalidates every surface a cake can appear on. */
function revalidateCakeSurfaces(slug?: string) {
  revalidatePath("/gallery");
  revalidatePath("/admin/cakes");
  if (slug) revalidatePath(`/gallery/${slug}`);
}

export async function createCakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow("ADMIN");

  const limited = checkAdminRateLimit(user.id, "mutation");
  if (!limited.allowed) return failure("You're doing that too quickly. Give it a moment.");

  const { parsed, images } = parseCakeForm(formData);

  if (!parsed.success) {
    return failure("Please check the highlighted fields.", zodFields(parsed.error.issues));
  }

  const input = parsed.data;

  try {
    const cake = await createCake({
      title: input.title,
      description: input.description,
      flavour: input.flavour,
      occasion: input.occasion,
      servings: input.servings,
      priceCents: input.priceCents,
      status: input.status,
      isFeatured: input.isFeatured,
      bakedAt: input.bakedAt,
      tags: input.tags,
    });

    const imageErrors: string[] = [];

    for (const [index, file] of images.entries()) {
      try {
        await uploadImage({
          target: { kind: "CAKE", cakeId: cake.id },
          file,
          alt: `${input.title}${images.length > 1 ? `, photo ${index + 1}` : ""}`,
          makeCover: index === 0,
        });
      } catch (error) {
        if (error instanceof UploadError) imageErrors.push(`${file.name}: ${error.message}`);
        else throw error;
      }
    }

    revalidateCakeSurfaces(cake.slug);
    logger.info("admin.cake.created", { userId: user.id, cakeId: cake.id, slug: cake.slug });

    if (imageErrors.length > 0) {
      // The cake exists, so send the baker to edit it with the problems listed
      // rather than pretending the whole thing failed.
      redirect(
        `/admin/cakes/${cake.id}?notice=${encodeURIComponent(
          `Cake saved, but some photos were skipped: ${imageErrors.join("; ")}`,
        )}`,
      );
    }

    redirect(`/admin/cakes/${cake.id}?notice=${encodeURIComponent("Cake created.")}`);
  } catch (error) {
    // `redirect()` signals via a thrown value; let it through untouched.
    if (isRedirectError(error)) throw error;

    logger.error("admin.cake.create.failed", { userId: user.id, error });
    return failure("We couldn't save that cake. Please try again.");
  }
}

export async function updateCakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow("ADMIN");

  const cakeId = String(formData.get("cakeId") ?? "").trim();
  if (!cakeId) return failure("Missing cake reference.");

  const { parsed, images } = parseCakeForm(formData);

  if (!parsed.success) {
    return failure("Please check the highlighted fields.", zodFields(parsed.error.issues));
  }

  const input = parsed.data;

  try {
    const cake = await updateCake(cakeId, {
      title: input.title,
      description: input.description,
      flavour: input.flavour,
      occasion: input.occasion,
      servings: input.servings,
      priceCents: input.priceCents,
      status: input.status,
      isFeatured: input.isFeatured,
      bakedAt: input.bakedAt,
      tags: input.tags,
    });

    const imageErrors: string[] = [];

    for (const file of images) {
      try {
        await uploadImage({
          target: { kind: "CAKE", cakeId },
          file,
          alt: `${input.title}, additional photo`,
        });
      } catch (error) {
        if (error instanceof UploadError) imageErrors.push(`${file.name}: ${error.message}`);
        else throw error;
      }
    }

    revalidateCakeSurfaces(cake.slug);
    logger.info("admin.cake.updated", { userId: user.id, cakeId, slug: cake.slug });

    return {
      ok: true,
      message:
        imageErrors.length > 0
          ? `Saved. Some photos were skipped: ${imageErrors.join("; ")}`
          : "Changes saved.",
    };
  } catch (error) {
    logger.error("admin.cake.update.failed", { userId: user.id, cakeId, error });
    return failure("We couldn't save those changes. Please try again.");
  }
}

export async function publishCakeAction(formData: FormData): Promise<void> {
  const user = await requireUserOrThrow("ADMIN");
  const cakeId = String(formData.get("cakeId") ?? "").trim();
  if (!cakeId) return;

  const cake = await publishCake(cakeId);
  revalidateCakeSurfaces(cake.slug);
  logger.info("admin.cake.published", { userId: user.id, cakeId });
}

export async function archiveCakeAction(formData: FormData): Promise<void> {
  const user = await requireUserOrThrow("ADMIN");
  const cakeId = String(formData.get("cakeId") ?? "").trim();
  if (!cakeId) return;

  await archiveCake(cakeId);
  revalidateCakeSurfaces();
  logger.info("admin.cake.archived", { userId: user.id, cakeId });
}

/** Hard delete. The UI routes through archive; this is for genuine mistakes. */
export async function deleteCakeAction(formData: FormData): Promise<void> {
  const user = await requireUserOrThrow("OWNER");
  const cakeId = String(formData.get("cakeId") ?? "").trim();
  if (!cakeId) return;

  await deleteCake(cakeId);
  revalidateCakeSurfaces();
  logger.warn("admin.cake.deleted", { userId: user.id, cakeId });

  redirect("/admin/cakes?notice=Cake deleted.");
}

export async function deleteCakeImageAction(formData: FormData): Promise<void> {
  const user = await requireUserOrThrow("ADMIN");

  const imageId = String(formData.get("imageId") ?? "").trim();
  const cakeId = String(formData.get("cakeId") ?? "").trim();
  if (!imageId || !cakeId) return;

  await deleteImage({ kind: "CAKE", imageId });
  revalidateCakeSurfaces();
  logger.info("admin.cake_image.deleted", { userId: user.id, imageId, cakeId });
}

/**
 * Next.js signals `redirect()` by throwing an object with a `digest` beginning
 * `NEXT_REDIRECT`. Re-throwing is required; swallowing it would leave the user
 * on a dead form.
 */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
