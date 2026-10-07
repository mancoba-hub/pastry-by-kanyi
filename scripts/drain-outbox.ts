import "dotenv/config";
import { drainOutbox } from "../src/server/outbox/dispatcher";
import { pruneSessions } from "../src/server/auth/session";
import { db } from "../src/lib/db";

/**
 * Outbox / maintenance worker entry point.
 *
 * Run on a schedule — `npm run outbox:drain` from cron, a platform scheduler, or
 * a container sidecar. It is safe to run concurrently with itself and with the
 * web app; work is claimed with an atomic status transition.
 *
 * Exits non-zero when work failed so the scheduler surfaces it.
 */
async function main() {
  const result = await drainOutbox(50);

  console.log(
    `outbox: processed=${result.processed} failed=${result.failed} skipped=${result.skipped}`,
  );

  // Cheap housekeeping alongside the drain, so no separate cron is needed.
  const pruned = await pruneSessions();
  if (pruned > 0) console.log(`sessions: pruned ${pruned} expired/revoked rows`);

  if (result.failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("outbox drain failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
