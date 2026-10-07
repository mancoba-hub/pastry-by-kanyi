import "dotenv/config";
import { afterAll } from "vitest";
import { db } from "@/lib/db";

/**
 * Vitest setup.
 *
 * Loads .env (Vitest does not do this for us, unlike Next.js) and closes the
 * Prisma connection pool once the suite finishes, so the process exits cleanly
 * instead of hanging on an open socket.
 */
afterAll(async () => {
  await db.$disconnect();
});
