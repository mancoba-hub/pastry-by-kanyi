import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * Cache Components and Partial Prefetching are on (the create-next-app default
 * for Next 16). Everything that renders on the public site is either static or
 * partially prerendered, so gallery traffic is absorbed by the CDN and the
 * database only serves writes and admin reads.
 */

/**
 * Derives allowed image hosts from the configured object storage.
 *
 * Next.js refuses to optimise images from hosts it does not know about, and the
 * bucket/CDN hostname is environment-specific, so it is read here rather than
 * hard-coded. `next.config.ts` is evaluated after Next loads .env files.
 */
function storageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const base = process.env.STORAGE_PUBLIC_BASE_URL?.trim();
  if (!base) return [];

  try {
    const url = new URL(base);

    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        pathname: "/**",
        search: "",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  images: {
    // Next 16 restricts optimisation to an explicit quality allow-list; a
    // disallowed value is coerced rather than honoured.
    qualities: [75, 90],
    formats: ["image/avif", "image/webp"],
    // Keys are content-addressed and immutable, so derived variants can be
    // cached for a long time.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: storageRemotePatterns(),
    // Local uploads are served by /api/media/... in development. Without this
    // pattern Next.js rejects them with a 400.
    localPatterns: [{ pathname: "/api/media/**", search: "" }],
  },

  experimental: {
    serverActions: {
      // Cake photos come straight off a phone camera. The default 1 MB limit
      // would silently reject most of them; the service layer enforces the real
      // per-file limit (see MAX_UPLOAD_BYTES).
      bodySizeLimit: "20mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
