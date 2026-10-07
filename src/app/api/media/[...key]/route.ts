import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Local storage read endpoint.
 *
 * Only active when STORAGE_DRIVER=local. In production the browser loads images
 * from the object store's CDN directly and this handler is never exercised —
 * which is the point: image bytes should not transit the app server.
 *
 * Two things it must get right:
 *   1. Path traversal. `key` comes from the URL, so it is resolved and then
 *      verified to still be inside the storage root.
 *   2. Caching. Keys are content-addressed and immutable, so responses are
 *      marked immutable and let the CDN/browser keep them forever.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const env = serverEnv();

  if (env.STORAGE_DRIVER !== "local") {
    return new Response("Not found", { status: 404 });
  }

  const { key } = await ctx.params;
  const relativeKey = key.join("/");

  // Runtime data directory, not source: annotated so the bundler does not trace
  // the entire project into the server output.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR);
  const target = path.resolve(/* turbopackIgnore: true */ root, relativeKey);

  // Reject anything that escapes the storage root.
  if (target !== root && !target.startsWith(root + path.sep)) {
    logger.warn("media.traversal.blocked", { relativeKey });
    return new Response("Not found", { status: 404 });
  }

  const extension = path.extname(target).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(/* turbopackIgnore: true */ target);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
