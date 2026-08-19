import path from "node:path";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 removed `url` and `directUrl` from the `datasource` block in
 * schema.prisma. Connection details for the CLI (migrate, db push, introspect,
 * studio) live here instead; the runtime connection is made by the driver
 * adapter in src/lib/prisma.ts.
 *
 * WHY DIRECT_URL AND NOT DATABASE_URL:
 * this project runs on Supabase, where DATABASE_URL points at the pgBouncer
 * connection pooler and DIRECT_URL at the database itself. Migrations cannot
 * run through a transaction-mode pooler — it does not support the session-level
 * statements and advisory locks Migrate relies on. That split is exactly what
 * the old `directUrl` property existed for, so the CLI keeps using the direct
 * connection here while application queries continue to go through the pooler.
 *
 * Getting this backwards fails at migrate time rather than silently, but it
 * fails confusingly ("prepared statement already exists"), so it is worth
 * stating.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },

  // Only declared when DIRECT_URL is actually present.
  //
  // `env()` resolves eagerly at config load, and the config is loaded by EVERY
  // prisma invocation — including the `prisma generate` that @prisma/client
  // runs from its own postinstall. Declaring it unconditionally therefore
  // breaks `pnpm install` anywhere the variable is absent, which is every CI
  // job here: none of them touch a database, and none define DIRECT_URL.
  //
  // The datasource is only required for commands that connect (migrate, db
  // push, introspect, studio), so leaving it out otherwise is correct rather
  // than a workaround. Those commands still fail loudly if the variable is
  // missing, which is the behaviour you want.
  ...(process.env.DIRECT_URL ? { datasource: { url: env("DIRECT_URL") } } : {}),
});
