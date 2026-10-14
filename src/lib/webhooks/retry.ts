import { prisma } from "@/lib/prisma";

/**
 * Exponential backoff with jitter for failed webhook deliveries.
 *
 * Strategy: 1m, 5m, 30m, 2h, 6h, 24h, give up
 *
 * The actual retry is performed by /api/cron/webhook-retry, which runs every 5 min
 * and picks up WebhookEvents with status=FAILED and nextRetryAt <= now.
 */

const RETRY_INTERVALS_MS = [
  60 * 1000, // 1 min
  5 * 60 * 1000, // 5 min
  30 * 60 * 1000, // 30 min
  2 * 60 * 60 * 1000, // 2 hours
  6 * 60 * 60 * 1000, // 6 hours
  24 * 60 * 60 * 1000, // 24 hours
];

const MAX_ATTEMPTS = RETRY_INTERVALS_MS.length;

/**
 * Schedule the next retry for a failed webhook event.
 * If max attempts exceeded, marks the event as permanently failed.
 */
export async function scheduleRetry(webhookEventId: string): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: { attempts: true },
  });

  if (!event) return;

  if (event.attempts > MAX_ATTEMPTS) {
    // `attempts` is already incremented by the caller before this runs, so
    // attempts === MAX_ATTEMPTS means "the Nth failure just happened" and
    // the Nth (last) retry interval below still needs to be scheduled.
    // Giving up here instead (the old `>=` check) skipped that last
    // interval, cutting the documented "1m, 5m, 30m, 2h, 6h, 24h, give up"
    // schedule short by one retry.
    // Permanently failed - admin should investigate
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "FAILED",
        nextRetryAt: null,
      },
    });
    console.warn(`[WEBHOOK PERMANENT FAILURE] event=${webhookEventId} - max attempts exceeded`);
    return;
  }

  const baseInterval: number =
    RETRY_INTERVALS_MS[event.attempts - 1] ?? RETRY_INTERVALS_MS[0] ?? 60_000;
  // Jitter: ±20% of the interval
  const jitter = (Math.random() - 0.5) * 0.4 * baseInterval;
  const nextRetryAt = new Date(Date.now() + baseInterval + jitter);

  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { nextRetryAt },
  });
}

/**
 * Get all webhook events that are due for retry.
 * Called by /api/cron/webhook-retry.
 */
export async function getEventsForRetry(): Promise<
  Array<{ id: string; endpointId: string; eventType: string; payload: unknown }>
> {
  const events = await prisma.webhookEvent.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: { lte: new Date() },
    },
    take: 50, // Process in batches to avoid timeouts
    orderBy: { nextRetryAt: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    endpointId: e.endpointId,
    eventType: e.eventType,
    payload: e.payload,
  }));
}
