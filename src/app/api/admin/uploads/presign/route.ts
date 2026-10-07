import { z } from "zod";
import { requireUserOrThrow } from "@/server/auth/guard";
import { storage } from "@/server/storage";
import { buildStorageKey, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/server/storage/images";
import { checkAdminRateLimit } from "@/server/admin/rate-limit";
import { failure, zodToFieldErrors } from "@/lib/result";
import { jsonFailure, jsonOk, NO_STORE_HEADERS, handleRoute } from "@/server/http";

/**
 * POST /api/admin/uploads/presign
 *
 * Hands the browser a short-lived, single-object URL to upload an image
 * directly to the object store. The image bytes never pass through this server,
 * which is what keeps uploads fast on a phone and keeps the app instance's CPU
 * and bandwidth free.
 *
 * Only available with STORAGE_DRIVER=s3. With the local driver the admin UI
 * posts the file to a Server Action instead, because there is nothing to
 * presign against.
 */

const presignSchema = z.object({
  kind: z.enum(["CAKE", "PRODUCT"]),
  entityId: z.string().trim().min(1).max(64),
  contentType: z.string().trim().min(1).max(100),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function POST(request: Request): Promise<Response> {
  return handleRoute("POST /api/admin/uploads/presign", async () => {
    const user = await requireUserOrThrow("ADMIN");

    const limited = checkAdminRateLimit(user.id, "presign", 120, 60 * 60 * 1000);
    if (!limited.allowed) {
      return jsonFailure(failure("RATE_LIMITED", "Too many uploads. Please wait a moment."));
    }

    const driver = storage();

    if (!driver.presignPut) {
      return jsonFailure(
        failure(
          "VALIDATION",
          "Direct uploads are disabled for the local storage driver. Use the admin upload form instead.",
        ),
        NO_STORE_HEADERS,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonFailure(failure("VALIDATION", "Expected a JSON body."));
    }

    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFailure(
        failure("VALIDATION", "That upload is not allowed.", zodToFieldErrors(parsed.error)),
      );
    }

    const { kind, entityId, contentType } = parsed.data;

    // The server chooses the key and the content type allow-list — a client
    // cannot talk us into storing an HTML file under /cakes/.
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
      return jsonFailure(
        failure("VALIDATION", `Unsupported image type. Allowed: ${ACCEPTED_IMAGE_TYPES.join(", ")}.`),
      );
    }

    const prefix = kind === "CAKE" ? "cakes" : "products";
    const key = buildStorageKey(prefix, entityId);
    const presigned = await driver.presignPut(key, contentType, 600);

    return jsonOk(presigned, { headers: NO_STORE_HEADERS });
  });
}
