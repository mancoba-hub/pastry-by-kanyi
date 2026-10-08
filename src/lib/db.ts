import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * A single PrismaClient per process.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise leak a new
 * connection pool on every edit. In production (serverless or container) the
 * module is evaluated once per instance, which is the pool size we want.
 *
 * The runtime talks to MariaDB/MySQL through the official MariaDB driver
 * adapter. `DATABASE_URL` may be written with either the `mysql://` or the
 * `mariadb://` scheme: the driver's own URL parser only understands
 * `mariadb://`, so the URL is decomposed here and an explicit pool config is
 * built instead. Pool sizing then lives in one place (`DATABASE_POOL_MAX`)
 * rather than being smeared across URL query parameters.
 */

type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/** Decomposes `mysql://user:password@host:3306/database` into pool settings. */
function parseDatabaseUrl(raw: string): DatabaseConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL — expected mysql://user:password@host:3306/database",
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) {
    throw new Error(
      "DATABASE_URL must include a host and a database name — expected mysql://user:password@host:3306/database",
    );
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    // Percent-encoded characters (e.g. `@` or `#` in a password) are decoded
    // here, so write them encoded in .env.
    password: decodeURIComponent(url.password),
    database,
  };
}

const createPrismaClient = () => {
  const env = serverEnv();

  const adapter = new PrismaMariaDb({
    ...parseDatabaseUrl(env.DATABASE_URL),
    // One pool per process. Next.js runs several worker processes during a
    // production build, so this multiplies — keep it comfortably below the
    // database account's max_user_connections.
    connectionLimit: env.DATABASE_POOL_MAX,
    // Release connections while the site is idle instead of holding the whole
    // pool open (matters on shared/managed database accounts). Seconds.
    minimumIdle: 1,
    idleTimeout: 300,
    // A hosted database can be a network hop away; the driver's 1s default is
    // tight for that.
    connectTimeout: 10_000,
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
