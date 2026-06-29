import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
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
