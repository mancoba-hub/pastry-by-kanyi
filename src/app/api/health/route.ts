import { connection } from "next/server";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

/**
 * GET /api/health
 *
 * Liveness + readiness probe. Deliberately checks the database, because an app
 * that is running but cannot reach MariaDB is *not* healthy and should be
 * pulled out of rotation.
 *
 * Kept as cheap as possible: a bounded `SELECT 1`, not a count over a large
 * table, so the probe cannot itself become the load.
 *
 * `connection()` keeps this out of the prerender: a health check that reports a
 * cached result from build time is worse than no health check at all.
 */
export async function GET(): Promise<Response> {
  await connection();

  const startedAt = Date.now();

  try {
    await db.$queryRaw`SELECT 1`;

    return Response.json(
      {
        status: "ok",
        checks: { database: "ok" },
        storage: serverEnv().STORAGE_DRIVER,
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        status: "degraded",
        checks: { database: "unreachable" },
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
