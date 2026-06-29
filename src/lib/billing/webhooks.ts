import { prisma, Prisma } from "@/lib/prisma";
import type { BillingEventType } from "@prisma/client";

/**
 * Idempotent webhook reconciliation.
 *
 * Both Stripe and Lemon Squeezy retry webhooks on failure. We MUST be idempotent
 * — re-processing the same event must not double-charge or double-record.
 *
 * Strategy: store every webhook as a BillingEvent row keyed by providerEventId.
 * Before processing, check if we already have that event.
 */

type ProcessedEvent = {
  organizationId: string;
  type: BillingEventType;
  amountCents: number;
  currency: string;
  provider: "stripe" | "lemonsqueezy";
  providerEventId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Record a billing event. Idempotent — if the providerEventId already exists,
 * returns the existing record without re-processing.
 *
 * @returns { created: boolean, event: BillingEvent } — `created` is false if the event
 *   was already processed (i.e., this is a duplicate webhook delivery).
 */
export async function recordBillingEvent(input: ProcessedEvent): Promise<{
  created: boolean;
}> {
  if (input.providerEventId) {
    const existing = await prisma.billingEvent.findUnique({
      where: { providerEventId: input.providerEventId },
    });
    if (existing) {
      return { created: false };
    }
  }

  await prisma.billingEvent.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      amountCents: input.amountCents,
      currency: input.currency,
      provider: input.provider,
      providerEventId: input.providerEventId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  return { created: true };
}

/**
 * Update the Subscription record based on a billing event.
 *
 * Called after `recordBillingEvent` returns `{ created: true }`.
 * Updates the subscription status, period dates, and provider IDs.
 */
export async function reconcileSubscription(input: {
  organizationId: string;
  provider: "stripe" | "lemonsqueezy";
  providerCustomerId?: string;
  providerSubId?: string;
  status: import("@prisma/client").SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  await prisma.subscription.upsert({
    where: {
      organizationId_provider: {
        organizationId: input.organizationId,
        provider: input.provider,
      },
    },
    update: {
      status: input.status,
      providerCustomerId: input.providerCustomerId,
      providerSubId: input.providerSubId,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    },
    create: {
      organizationId: input.organizationId,
      planId: "default-plan-id", // Override in caller
      status: input.status,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId,
      providerSubId: input.providerSubId,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
    },
  });
}
