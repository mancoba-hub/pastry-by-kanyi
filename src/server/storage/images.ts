import sharp from "sharp";
import { randomCode } from "@/lib/ids";
import type { ProcessedImage } from "./types";

/**
 * Image normalisation.
 *
 * Bakers upload straight from a phone camera, which means 4-12 MB HEIC/JPEG
 * files with EXIF rotation and no web optimisation. Every upload is therefore
 * normalised once, at the edge of the system, so that nothing downstream has to
 * think about it:
 *
 *   - EXIF orientation is baked in, then metadata (including GPS) is stripped
 *   - the long edge is capped, so a 6000px photo never reaches a CDN
 *   - output is WebP, typically 85-95% smaller than the original
 *   - a tiny inline blur placeholder is generated for the gallery grid
 *
 * Storing one canonical rendition (rather than pre-generating every size) keeps
 * storage cheap while Next.js Image derives the responsive sizes on demand.
 */

const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 82;
const BLUR_WIDTH = 16;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

/**
 * Normalises an uploaded image and produces its blur placeholder.
 * Throws `UnsupportedImageError` for anything sharp cannot decode.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new UnsupportedImageError("The uploaded file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnsupportedImageError(
      `Image is ${(input.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB.`,
    );
  }

  try {
    const pipeline = sharp(input, { failOn: "error" }).rotate();
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new UnsupportedImageError("That file does not look like an image we can read.");
    }

    const resized = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

    // sharp pipelines are lazy and single-use; clone before consuming.
    const [data, blurBuffer] = await Promise.all([
      resized.clone().webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer(),
      sharp(input, { failOn: "error" })
        .rotate()
        .resize({ width: BLUR_WIDTH, fit: "inside" })
        .blur(1.2)
        .jpeg({ quality: 45 })
        .toBuffer(),
    ]);

    const finalMeta = await sharp(data).metadata();

    return {
      data,
      contentType: "image/webp",
      width: finalMeta.width ?? metadata.width,
      height: finalMeta.height ?? metadata.height,
      byteSize: data.byteLength,
      blurDataUrl: `data:image/jpeg;base64,${blurBuffer.toString("base64")}`,
    };
  } catch (error) {
    if (error instanceof UnsupportedImageError) throw error;

    throw new UnsupportedImageError(
      `Could not process that image (${error instanceof Error ? error.message : "unknown error"}). ` +
        "Try a JPEG or PNG exported from your phone's photo app.",
    );
  }
}

/**
 * Content-addressed storage key: `cakes/<cakeId>/<random>.webp`.
 *
 * The random suffix (not the original filename) is what makes the key safe to
 * cache forever and impossible to enumerate. `prefix` keeps objects grouped by
 * entity so a cake can be deleted with a single prefix listing.
 */
export function buildStorageKey(
  prefix: "cakes" | "products",
  entityId: string,
  ext = "webp",
): string {
  return `${prefix}/${entityId}/${Date.now().toString(36)}-${randomCode(6).toLowerCase()}.${ext}`;
}
