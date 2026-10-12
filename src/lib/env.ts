import { z } from "zod";

/**
 * Server environment.
 *
 * Validation is lazy (see `serverEnv()`) rather than evaluated at module import
 * time. Next.js evaluates modules during `next build`; failing fast at import
 * would make a missing runtime secret break the build instead of the request.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (PostgreSQL connection string)")
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
    }),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters — use a random 32-byte value"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".uploads"),
  STORAGE_PUBLIC_BASE_URL: z.string().default(""),

  S3_BUCKET: z.string().default(""),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),

  REDIS_URL: z.string().default(""),
  ORDER_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),

  /**
   * Max connections per process. Every service instance — and every worker
   * process `next build`/`next start` spawns — opens its own pool, so keep this
   * comfortably below the database plan's connection limit. Raise it only for a
   * dedicated database with headroom, e.g. a self-hosted instance serving a few
   * long-lived containers.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/**
 * Reads and validates server env vars once per process.
 * Throws a readable error listing every problem, not just the first.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}\n\nSee .env.example.`);
  }

  const env = parsed.data;

  if (env.STORAGE_DRIVER === "s3") {
    const missing = (
      ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "STORAGE_PUBLIC_BASE_URL"] as const
    ).filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(", ")}. See .env.example.`);
    }
  }

  cached = env;
  return env;
}

/**
 * Public env. Inlined at build time by Next.js, so these must be referenced as
 * full `process.env.NEXT_PUBLIC_*` expressions (no dynamic destructuring).
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Pastry Box by Kanyi",
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, ""),
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "ZAR",
  deliveryFeeCents: Number.parseInt(process.env.NEXT_PUBLIC_DELIVERY_FEE_CENTS ?? "0", 10) || 0,
  businessPhone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "",
  businessEmail: process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "",
  businessLocation: process.env.NEXT_PUBLIC_BUSINESS_LOCATION ?? "",
  instagramHandle: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? "",
} as const;

/** True when the app is running production with an https canonical URL. */
export const isProductionDeploy = () =>
  process.env.NODE_ENV === "production" && publicEnv.siteUrl.startsWith("https://");
