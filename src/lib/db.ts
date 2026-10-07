import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * A single PrismaClient per process.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise leak a new
 * connection pool on every edit. In production (serverless or container) the
 * module is evaluated once per instance, which is the pool size we want.
 *
 * Scale note: `DATABASE_URL` should point at a *pooled* endpoint (PgBouncer).
 * The Prisma CLI uses `DIRECT_URL` for migrations — see prisma7.config.ts.
 */

const createPrismaClient = () => {
  const env = serverEnv();

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // One pool per process. Next.js runs several worker processes during a
    // production build, so this multiplies — keep it small on a pooled endpoint.
    max: env.DATABASE_POOL_MAX,
    // Managed Postgres providers terminate idle TLS connections; recycle first.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = db;
}

/** Prisma transaction client — the `tx` passed to `db.$transaction(async (tx) => …)`. */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export { Prisma } from "@/generated/prisma/client";
