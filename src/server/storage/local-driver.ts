import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";
import type { PutResult, StorageDriver } from "./types";

/**
 * Filesystem storage, for local development.
 *
 * Objects are written to a gitignored directory *outside* `public/` and served
 * by the `/api/media/[...key]` route handler. Writing into `public/` would work
 * in dev but silently break on any read-only or ephemeral filesystem, so the
 * two environments would behave differently — exactly the bug you do not want
 * to discover on launch day.
 */
export function createLocalStorageDriver(opts: {
  directory: string;
  /** Origin used to build absolute URLs; empty yields root-relative ones. */
  baseUrl?: string;
}): StorageDriver {
  // Runtime data directory, not source: annotated so the bundler does not trace
  // the entire project into the server output.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), opts.directory);
  const baseUrl = (opts.baseUrl ?? "").replace(/\/$/, "");

  /** Blocks path traversal — keys arrive from presign requests. */
  const resolveSafe = (key: string): string => {
    // The storage directory is a runtime data path, not source code. Without
    // this hint Turbopack cannot scope the dynamic access and traces the entire
    // project into the server bundle, bloating every deploy.
    const target = path.resolve(/* turbopackIgnore: true */ root, key);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Refusing to write outside the storage root: ${key}`);
    }
    return target;
  };

  return {
    name: "local",

    publicUrl(key: string): string {
      return `${baseUrl}/api/media/${key}`;
    },

    async put(key: string, data: Buffer): Promise<PutResult> {
      const target = resolveSafe(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);

      logger.debug("storage.local.put", { key, byteSize: data.byteLength });
      return { key, url: this.publicUrl(key), byteSize: data.byteLength };
    },

    async delete(key: string): Promise<void> {
      try {
        await unlink(resolveSafe(key));
        logger.debug("storage.local.delete", { key });
      } catch (error) {
        // Already gone is the desired end state, so only unexpected codes surface.
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw error;
      }
    },
  };
}
