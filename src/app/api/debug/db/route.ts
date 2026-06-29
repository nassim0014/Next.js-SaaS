import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Debug endpoint — shows exactly what DATABASE_URL the Next.js process sees,
 * and attempts a Prisma query. Use this to diagnose connection issues.
 *
 * Visit: http://localhost:3000/api/debug/db
 *
 * Compare the output to what `set -a && source .env && set +a && pnpm tsx scripts/test-db.ts` shows.
 * If the URLs differ, .env.local is overriding .env.
 * If the URLs match but Prisma fails here, the issue is Turbopack/Next.js specific.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  // Mask the password for display
  const mask = (url: string | undefined) => {
    if (!url) return "(not set)";
    return url.replace(/:[^:@]+@/, ":****@");
  };

  // Try a simple Prisma query
  let prismaStatus: { ok: boolean; userCount?: number; error?: string };
  try {
    const count = await prisma.user.count();
    prismaStatus = { ok: true, userCount: count };
  } catch (err) {
    prismaStatus = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json({
    runtime: process.env.NEXT_RUNTIME,
    nodeVersion: process.version,
    env: {
      DATABASE_URL: mask(dbUrl),
      DIRECT_URL: mask(directUrl),
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)",
    },
    prisma: prismaStatus,
    timestamp: new Date().toISOString(),
  });
}
