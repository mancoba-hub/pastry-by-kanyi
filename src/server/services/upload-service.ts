import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CACHE_TAGS } from "@/server/cache-tags";
import { storage } from "@/server/storage";
import {
  buildStorageKey,
  processImage,
  UnsupportedImageError,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/server/storage/images";

/**
 * Image upload service.
 *
 * The one place images enter the system. Responsibilities:
 *   validate → normalise (sharp) → persist bytes → record the row → expire caches
 *
 * Ordering matters. Bytes are written to object storage *before* the database
 * row, so the failure mode is an orphaned object (harmless, cheap to sweep)
 * rather than a row pointing at nothing (a broken image on the live site).
 */

export type UploadTarget = { kind: "CAKE"; cakeId: string } | { kind: "PRODUCT"; productId: string };

export type UploadedImage = {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  isCover: boolean;
};

export class UploadError extends Error {
  constructor(
    message: string,
    readonly code: "UNSUPPORTED" | "TOO_LARGE" | "TARGET_MISSING" | "LIMIT_REACHED",
  ) {
    super(message);
    this.name = "UploadError";
  }
}

const MAX_IMAGES_PER_ENTITY = 12;

function describeLimit() {
  return `Images must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB and one of: ${ACCEPTED_IMAGE_TYPES.join(", ")}.`;
}

/**
 * Stores one image for a cake or product.
 *
 * `db.$transaction` is not used across storage + database because the storage
 * call is a network request and would hold a connection open. The compensation
 * is the ordering described above.
 */
export async function uploadImage(args: {
  target: UploadTarget;
  file: File;
  alt: string;
  makeCover?: boolean;
}): Promise<UploadedImage> {
  const { target, file, alt } = args;

  const entityId = target.kind === "CAKE" ? target.cakeId : target.productId;
  const prefix = target.kind === "CAKE" ? "cakes" : "products";

  const exists =
    target.kind === "CAKE"
      ? await db.cake.findUnique({ where: { id: entityId }, select: { id: true } })
      : await db.product.findUnique({ where: { id: entityId }, select: { id: true } });

  if (!exists) throw new UploadError("That item no longer exists.", "TARGET_MISSING");

  const existingCount = await db.cakeImage.count({ where: { cakeId: entityId } }).catch(() => 0);
  if (target.kind === "CAKE" && existingCount >= MAX_IMAGES_PER_ENTITY) {
    throw new UploadError(`A cake can have at most ${MAX_IMAGES_PER_ENTITY} photos.`, "LIMIT_REACHED");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let processed;
  try {
    processed = await processImage(buffer);
  } catch (error) {
    if (error instanceof UnsupportedImageError) {
      throw new UploadError(`${error.message} ${describeLimit()}`, "UNSUPPORTED");
    }
    throw error;
  }

  const key = buildStorageKey(prefix, entityId);
  const stored = await storage().put(key, processed.data, processed.contentType);

  if (target.kind === "CAKE") {
    const isFirst = (await db.cakeImage.count({ where: { cakeId: entityId } })) === 0;
    const isCover = args.makeCover === true || isFirst;

    const image = await db.$transaction(async (tx) => {
      if (isCover) {
        await tx.cakeImage.updateMany({ where: { cakeId: entityId }, data: { isCover: false } });
      }

      return tx.cakeImage.create({
        data: {
          cakeId: entityId,
          storageKey: stored.key,
          url: stored.url,
          width: processed.width,
          height: processed.height,
          blurDataUrl: processed.blurDataUrl,
          byteSize: processed.byteSize,
          alt,
          isCover,
          position: await tx.cakeImage.count({ where: { cakeId: entityId } }),
        },
        select: {
          id: true,
          url: true,
          alt: true,
          width: true,
          height: true,
          blurDataUrl: true,
          isCover: true,
        },
      });
    });

    updateTag(CACHE_TAGS.cakes);
    const cake = await db.cake.findUnique({ where: { id: entityId }, select: { slug: true } });
    if (cake) updateTag(CACHE_TAGS.cake(cake.slug));

    logger.info("image.uploaded", { kind: "CAKE", entityId, key: stored.key, bytes: processed.byteSize });
    return image;
  }

  const isFirst = (await db.productImage.count({ where: { productId: entityId } })) === 0;
  const isCover = args.makeCover === true || isFirst;

  const image = await db.$transaction(async (tx) => {
    if (isCover) {
      await tx.productImage.updateMany({ where: { productId: entityId }, data: { isCover: false } });
    }

    return tx.productImage.create({
      data: {
        productId: entityId,
        storageKey: stored.key,
        url: stored.url,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        alt,
        isCover,
        position: await tx.productImage.count({ where: { productId: entityId } }),
      },
      select: {
        id: true,
        url: true,
        alt: true,
        width: true,
        height: true,
        blurDataUrl: true,
        isCover: true,
      },
    });
  });

  updateTag(CACHE_TAGS.products);
  const product = await db.product.findUnique({ where: { id: entityId }, select: { slug: true } });
  if (product) updateTag(CACHE_TAGS.product(product.slug));

  logger.info("image.uploaded", { kind: "PRODUCT", entityId, key: stored.key, bytes: processed.byteSize });
  return image;
}

/** Removes an image row and its stored object. */
export async function deleteImage(args: { kind: "CAKE" | "PRODUCT"; imageId: string }): Promise<void> {
  if (args.kind === "CAKE") {
    const image = await db.cakeImage.findUnique({
      where: { id: args.imageId },
      select: { storageKey: true, cakeId: true, cake: { select: { slug: true } } },
    });
    if (!image) return;

    await db.cakeImage.delete({ where: { id: args.imageId } });

    // Promote another photo to cover so the grid never renders imageless.
    if (image.cakeId) {
      const remaining = await db.cakeImage.findFirst({
        where: { cakeId: image.cakeId, isCover: false },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const hasCover = await db.cakeImage.count({ where: { cakeId: image.cakeId, isCover: true } });

      if (hasCover === 0 && remaining) {
        await db.cakeImage.update({ where: { id: remaining.id }, data: { isCover: true } });
      }

      updateTag(CACHE_TAGS.cakes);
      updateTag(CACHE_TAGS.cake(image.cake.slug));
    }

    await storage()
      .delete(image.storageKey)
      .catch((error: unknown) => logger.warn("image.delete.object.failed", { error }));

    return;
  }

  const image = await db.productImage.findUnique({
    where: { id: args.imageId },
    select: { storageKey: true, productId: true, product: { select: { slug: true } } },
  });
  if (!image) return;

  await db.productImage.delete({ where: { id: args.imageId } });
  updateTag(CACHE_TAGS.products);

  if (image.productId) {
    updateTag(CACHE_TAGS.product(image.product.slug));
  }

  await storage()
    .delete(image.storageKey)
    .catch((error: unknown) => logger.warn("image.delete.object.failed", { error }));
}
