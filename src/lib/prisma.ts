import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// =============================================================================
// IPv4-first DNS — fixes Prisma connection failures on networks without IPv6.
// =============================================================================
// Why here: Turbopack spawns separate worker processes for route handlers.
// The instrumentation.ts hook only runs in the main process, NOT in workers.
// Putting dns.setDefaultResultOrder here ensures it runs in EVERY process
// that imports Prisma — including Turbopack workers.
//
// Without this, Node.js tries IPv6 first → fails on networks without IPv6
// → Prisma gives up with "Can't reach database server" error.
//
// The standalone script (scripts/test-db.ts) works because it runs in a
// single process where the instrumentation hook's setting applies.
// =============================================================================
try {
  // Intentionally dynamic: must stay synchronous and catchable if
  // node:dns doesn't exist in the current runtime (e.g. Edge). A static
  // top-level import would fail at module-eval time instead, defeating
  // this try/catch guard.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dns = require("node:dns");
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Edge runtime or unsupported environment — safe to ignore
}

// =============================================================================
// Driver adapter — required from Prisma 7.
// =============================================================================
// Prisma 7 no longer reads the connection URL from schema.prisma and no longer
// opens the connection itself. The PrismaClient constructor takes a driver
// adapter instead; here that is node-postgres via @prisma/adapter-pg.
//
// DATABASE_URL (not DIRECT_URL) is correct at runtime: on Supabase it points at
// the pgBouncer pooler, which is what application queries should use. The
// direct connection is reserved for migrations and is configured separately in
// prisma.config.ts.
//
// The ipv4first setting above still applies — `pg` resolves the host through
// the same Node DNS layer, so the fix keeps working under the adapter.
// =============================================================================
// Deliberately NOT throwing when DATABASE_URL is absent. `next build` collects
// page data by importing route modules — including ones that import this file —
// in an environment with no database configured. Throwing at module scope turns
// a missing env var into a build failure:
//
//   Failed to collect page data for /api/debug/db
//
// pg surfaces the missing connection at connect time instead, which is the same
// place Prisma 6 reported it, so nothing is lost by staying lazy here.
const connectionString = process.env.DATABASE_URL;

// Singleton pattern — prevents exhausting DB connections during dev hot reload.
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export { Prisma };

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
