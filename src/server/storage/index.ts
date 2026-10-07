import { serverEnv } from "@/lib/env";
import { createLocalStorageDriver } from "./local-driver";
import { createS3StorageDriver } from "./s3-driver";
import type { StorageDriver } from "./types";

export type { ProcessedImage, PutResult, StorageDriver } from "./types";

let cached: StorageDriver | null = null;

/**
 * Returns the configured storage driver (see .env: STORAGE_DRIVER).
 * Constructed once per process; the S3 client maintains its own connection pool.
 */
export function storage(): StorageDriver {
  if (cached) return cached;

  const env = serverEnv();

  cached =
    env.STORAGE_DRIVER === "s3"
      ? createS3StorageDriver({
          bucket: env.S3_BUCKET,
          region: env.S3_REGION,
          endpoint: env.S3_ENDPOINT || undefined,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
        })
      : createLocalStorageDriver({
          directory: env.STORAGE_LOCAL_DIR,
          baseUrl: env.STORAGE_PUBLIC_BASE_URL,
        });

  return cached;
}
