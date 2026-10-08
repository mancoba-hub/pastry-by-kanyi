// Prisma CLI configuration (Prisma 7 resolves `prisma7.config.ts` for this release).
//
// The CLI (migrate/introspect) runs against `DIRECT_URL` when your provider
// gives you a separate endpoint for it; most MariaDB/MySQL hosts (HostAfrica
// included) hand you one account, so `DATABASE_URL` is used as the fallback.
// The runtime PrismaClient connects through the driver adapter in src/lib/db.ts
// and only ever reads `DATABASE_URL`.
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
    // `||` (not `??`) so an empty DIRECT_URL also falls back to DATABASE_URL.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
    // `prisma migrate dev` diffs against a scratch "shadow" database. Hosts
    // that do not let the database user CREATE DATABASE need this pointed at a
    // separate database; leave it unset locally and Prisma creates and drops
    // its own. Production runs `migrate deploy`, which never needs a shadow.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] || undefined,
  },
});
