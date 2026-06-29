import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health check endpoint.
 *
 * /api/health/live  — liveness probe (always returns 200 if process is alive)
 * /api/health/ready — readiness probe (checks DB connectivity)
 *
 * Use these for Kubernetes / Vercel / Cloudflare health checks.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isReadyCheck = url.pathname.endsWith("/ready");

  if (!isReadyCheck) {
    return NextResponse.json({ status: "alive", timestamp: new Date().toISOString() });
  }

  try {
    // Quick DB ping
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
