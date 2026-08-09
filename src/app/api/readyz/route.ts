import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Readiness probe — checks DB connectivity. Used for Kubernetes / Vercel /
 * Cloudflare health checks; traffic should not be routed to an instance
 * until this returns 200.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      database: "ok",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "unready",
        timestamp: new Date().toISOString(),
        database: "error",
        error: err instanceof Error ? err.message : "Unknown",
      },
      { status: 503 }
    );
  }
}
