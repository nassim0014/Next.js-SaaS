import { NextResponse } from "next/server";

/**
 * Liveness probe — returns 200 if the process is alive. No dependency
 * checks (that's /api/readyz). Used for Kubernetes / Vercel / Cloudflare
 * health checks.
 */
export async function GET() {
  return NextResponse.json({ status: "alive", timestamp: new Date().toISOString() });
}
