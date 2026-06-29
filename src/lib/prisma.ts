import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
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
  const dns = require("node:dns");
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Edge runtime or unsupported environment — safe to ignore
}

// Singleton pattern — prevents exhausting DB connections during dev hot reload.
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export { Prisma };

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
