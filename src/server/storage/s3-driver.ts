import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/lib/logger";
import type { PutResult, StorageDriver } from "./types";

/**
 * S3-compatible object storage: Cloudflare R2, AWS S3, Supabase Storage, MinIO.
 *
 * R2 is the recommended target: it charges no egress, and a photo gallery is
 * almost entirely egress. `S3_ENDPOINT` is what makes the driver provider
 * agnostic — leave it empty for AWS, set it for R2/MinIO.
 */
export function createS3StorageDriver(opts: {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public CDN base for reads, e.g. https://cdn.pastrybykanyi.com */
  publicBaseUrl: string;
}): StorageDriver {
  const client = new S3Client({
    region: opts.region,
    ...(opts.endpoint ? { endpoint: opts.endpoint, forcePathStyle: false } : {}),
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
  });

  const base = opts.publicBaseUrl.replace(/\/$/, "");

  return {
    name: "s3",

    publicUrl(key: string): string {
      return `${base}/${key}`;
    },

    async put(key: string, data: Buffer, contentType: string): Promise<PutResult> {
      await client.send(
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          // Immutable, content-addressed keys: cache hard and for a long time.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );

      logger.debug("storage.s3.put", { key, byteSize: data.byteLength });
      return { key, url: this.publicUrl(key), byteSize: data.byteLength };
    },

    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: opts.bucket, Key: key }));
      logger.debug("storage.s3.delete", { key });
    },

    async presignPut(key, contentType, expiresInSeconds = 600) {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: key,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
        { expiresIn: expiresInSeconds },
      );

      return {
        uploadUrl,
        key,
        publicUrl: this.publicUrl(key),
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
      };
    },
  };
}
