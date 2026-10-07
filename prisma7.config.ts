// Prisma CLI configuration (Prisma 7 resolves `prisma7.config.ts` for this release).
//
// Note there is no `directUrl` in Prisma 7 — the split is:
//   * the CLI (migrate/introspect) uses `DIRECT_URL` below, which must bypass
//     any connection pooler because PgBouncer cannot run DDL in transaction mode
//   * the runtime PrismaClient uses the POOLED `DATABASE_URL`, wired up through
//     the driver adapter in src/lib/db.ts
//
// `dotenv/config` is required: Prisma 7 does not read .env files on its own.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Falls back to DATABASE_URL for single-endpoint databases (local dev,
    // self-hosted Postgres) that have no pooler to bypass.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
    // `prisma migrate dev` diffs against a scratch "shadow" database. Managed
    // Postgres that exposes only one database (e.g. Prisma Dev) needs this
    // pointed at a separate endpoint; leave it unset elsewhere and Prisma
    // creates a temporary one.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] || undefined,
  },
});
