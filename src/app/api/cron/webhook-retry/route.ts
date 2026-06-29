import { NextRequest, NextResponse } from "next/server";
import { getEventsForRetry } from "@/lib/webhooks/retry";
import { prisma } from "@/lib/prisma";
import { signWebhook } from "@/lib/webhooks/signer";

/**
 * Cron job — retries failed outbound webhook deliveries.
 *
 * Runs every 5 min via Vercel Cron / Cloudflare Cron.
 * Schedule expression: "0-59/5 * * * *" (every 5 minutes)
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await getEventsForRetry();
  let retried = 0;
  let succeeded = 0;

  for (const event of events) {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: event.endpointId },
    });
    if (!endpoint || !endpoint.isActive) continue;

    const body = JSON.stringify({
      event: event.eventType,
      payload: event.payload,
      timestamp: new Date().toISOString(),
      retry: true,
    });
    const signature = signWebhook(body, endpoint.secret);

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event.eventType,
          "X-Webhook-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      retried++;
      if (response.ok) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "DELIVERED",
            responseCode: response.status,
            deliveredAt: new Date(),
            nextRetryAt: null,
          },
        });
        succeeded++;
      } else {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            responseCode: response.status,
            attempts: { increment: 1 },
          },
        });
      }
    } catch {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    retried,
    succeeded,
    timestamp: new Date().toISOString(),
  });
}
