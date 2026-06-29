import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rollupCurrentPeriod } from "@/lib/billing/metering";

/**
 * Cron job — rolls up token usage into UsageRecord for every org.
 *
 * Runs nightly via Vercel Cron / Cloudflare Cron / GitHub Actions:
 *
 *   # vercel.json
 *   "crons": [{ "path": "/api/cron/usage-meter", "schedule": "0 0 * * *" }]
 *
 * Protected by CRON_SECRET — set in .env.local.
 */

export async function GET(req: NextRequest) {
  // Verify the cron secret
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all orgs that have an active subscription
    const orgs = await prisma.organization.findMany({
      where: {
        subscriptions: { some: { status: { in: ["ACTIVE", "TRIALING"] } } },
      },
      select: { id: true },
    });

    const results = await Promise.allSettled(orgs.map((org) => rollupCurrentPeriod(org.id)));

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      processed: orgs.length,
      succeeded,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON USAGE-METER ERROR]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
