/**
 * Storage abstraction.
 *
 * Two drivers ship today:
 *   - local: filesystem, for development and single-box deployments
 *   - s3:    any S3-compatible object store (Cloudflare R2, AWS S3, Supabase, MinIO)
 *
 * The application never streams image bytes through a request handler in
 * production: the browser uploads straight to the bucket with a presigned URL,
 * then the object is served from a CDN. That keeps the app server out of the
 * bandwidth path entirely, which is what makes the gallery cheap at scale.
 */

export type StorageDriverName = "local" | "s3";

/** Result of normalising an uploaded image for the web. */
export type ProcessedImage = {
  data: Buffer;
  contentType: string;
  width: number;
  height: number;
  byteSize: number;
  /** Tiny inline JPEG used as the `blurDataURL` placeholder. */
  blurDataUrl: string;
};

export type PutResult = {
  key: string;
  url: string;
  byteSize: number;
};

export interface StorageDriver {
  readonly name: StorageDriverName;

  /** Uploads bytes. Used by the local driver and by server-side fallbacks. */
  put(key: string, data: Buffer, contentType: string): Promise<PutResult>;

  /** Removes an object. Missing objects are not an error. */
  delete(key: string): Promise<void>;

  /** Absolute or root-relative URL the browser should load. */
  publicUrl(key: string): string;

  /**
   * Presigned direct upload. When present, the browser uploads without
   * proxying bytes through the app server.
   */
  presignPut?(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string; headers: Record<string, string> }>;
}
