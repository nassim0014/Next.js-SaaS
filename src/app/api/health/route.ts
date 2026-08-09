import { NextResponse } from "next/server";

/**
 * /api/health — kept as a liveness alias for backward compatibility with
 * anything already pointed at this URL.
 *
 * The real, documented health-check endpoints are /api/livez (liveness) and
 * /api/readyz (readiness, checks DB connectivity) — see those route files.
 * This used to try to serve both from one handler by branching on
 * `req.url.pathname.endsWith("/ready")`, but that branch was unreachable:
 * Next.js only routes exact-path requests to a given route.ts, so a request
 * to a sub-path never reached this file at all.
 */
export async function GET() {
  return NextResponse.json({ status: "alive", timestamp: new Date().toISOString() });
}
