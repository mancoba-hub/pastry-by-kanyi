"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/server/auth/guard";
import { checkAdminRateLimit } from "@/server/admin/rate-limit";
import { createProduct, deleteProduct, updateProduct } from "@/server/services/product-service";
import { deleteImage, uploadImage, UploadError } from "@/server/services/upload-service";
import { logger } from "@/lib/logger";
import { parseProductForm, zodFields, type ActionState } from "@/features/admin/schema";

/** Product admin actions — same shape and guardrails as the cake actions. */

function failure(message: string, fields?: Record<string, string[]>): ActionState {
  return { ok: false, message, ...(fields ? { fields } : {}) };
}

function revalidateProductSurfaces(slug?: string) {
  revalidatePath("/shop");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/shop/${slug}`);
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow("ADMIN");

  const limited = checkAdminRateLimit(user.id, "mutation");
  if (!limited.allowed) return failure("You're doing that too quickly. Give it a moment.");

  const { parsed, images } = parseProductForm(formData);

  if (!parsed.success) {
    return failure("Please check the highlighted fields.", zodFields(parsed.error.issues));
  }

  const input = parsed.data;

  try {
    const product = await createProduct({
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      unitLabel: input.unitLabel,
      status: input.status,
      isFeatured: input.isFeatured,
      stockQty: input.stockQty,
      maxPerOrder: input.maxPerOrder,
    });

    const imageErrors: string[] = [];

    for (const [index, file] of images.entries()) {
      try {
        await uploadImage({
          target: { kind: "PRODUCT", productId: product.id },
          file,
          alt: `${input.name}${images.length > 1 ? `, photo ${index + 1}` : ""}`,
          makeCover: index === 0,
        });
      } catch (error) {
        if (error instanceof UploadError) imageErrors.push(`${file.name}: ${error.message}`);
        else throw error;
      }
    }

    revalidateProductSurfaces(product.slug);
    logger.info("admin.product.created", { userId: user.id, productId: product.id });

    redirect(
      `/admin/products?notice=${encodeURIComponent(
        imageErrors.length > 0
          ? `Product saved. Photos skipped: ${imageErrors.join("; ")}`
          : "Product created.",
      )}`,
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;

    logger.error("admin.product.create.failed", { userId: user.id, error });
    return failure("We couldn't save that product. Please try again.");
  }
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow("ADMIN");

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return failure("Missing product reference.");

  const { parsed, images } = parseProductForm(formData);

  if (!parsed.success) {
    return failure("Please check the highlighted fields.", zodFields(parsed.error.issues));
  }

  const input = parsed.data;

  try {
    const product = await updateProduct(productId, {
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      unitLabel: input.unitLabel,
      status: input.status,
      isFeatured: input.isFeatured,
      stockQty: input.stockQty,
      maxPerOrder: input.maxPerOrder,
    });

    const imageErrors: string[] = [];

    for (const file of images) {
      try {
        await uploadImage({
          target: { kind: "PRODUCT", productId },
          file,
          alt: `${input.name}, additional photo`,
        });
      } catch (error) {
        if (error instanceof UploadError) imageErrors.push(`${file.name}: ${error.message}`);
        else throw error;
      }
    }

    revalidateProductSurfaces(product.slug);
    logger.info("admin.product.updated", { userId: user.id, productId });

    return {
      ok: true,
      message:
        imageErrors.length > 0
          ? `Saved. Some photos were skipped: ${imageErrors.join("; ")}`
          : "Changes saved.",
    };
  } catch (error) {
    logger.error("admin.product.update.failed", { userId: user.id, productId, error });
    return failure("We couldn't save those changes. Please try again.");
  }
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await requireUserOrThrow("OWNER");

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return;

  await deleteProduct(productId);
  revalidateProductSurfaces();

  logger.warn("admin.product.deleted", { userId: user.id, productId });
  redirect("/admin/products?notice=Product deleted.");
}

export async function deleteProductImageAction(formData: FormData): Promise<void> {
  const user = await requireUserOrThrow("ADMIN");

  const imageId = String(formData.get("imageId") ?? "").trim();
  if (!imageId) return;

  await deleteImage({ kind: "PRODUCT", imageId });
  revalidateProductSurfaces();
  logger.info("admin.product_image.deleted", { userId: user.id, imageId });
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
