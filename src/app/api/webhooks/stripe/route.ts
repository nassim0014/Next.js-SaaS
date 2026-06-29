import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeWebhookSignature, stripe } from "@/lib/billing/stripe";
import { recordBillingEvent, reconcileSubscription } from "@/lib/billing/webhooks";
import type { SubscriptionStatus } from "@prisma/client";

/**
 * Stripe webhook handler.
 *
 * Receives events from Stripe and reconciles them into our DB.
 * Idempotent — duplicate deliveries are deduplicated via providerEventId.
 *
 * Configure in Stripe Dashboard → Webhooks:
 *   URL: https://your-domain.com/api/webhooks/stripe
 *   Events:
 *     - checkout.session.completed
 *     - customer.subscription.created
 *     - customer.subscription.updated
 *     - customer.subscription.deleted
 *     - invoice.paid
 *     - invoice.payment_failed
 *
 * For local dev:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = verifyStripeWebhookSignature(payload, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Extract orgId from metadata (we attach it during checkout)
  const orgId =
    (event.data.object as { metadata?: { orgId?: string } }).metadata?.orgId ?? null;

  if (!orgId) {
    // No orgId — likely a test event or unrelated event. Acknowledge and skip.
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await recordBillingEvent({
          organizationId: orgId,
          type: "SUBSCRIPTION_CREATED",
          amountCents: (event.data.object as { amount_total?: number }).amount_total ?? 0,
          currency: "usd",
          provider: "stripe",
          providerEventId: event.id,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
        };

        const statusMap: Record<string, SubscriptionStatus> = {
          active: "ACTIVE",
          past_due: "PAST_DUE",
          canceled: "CANCELED",
          trialing: "TRIALING",
          paused: "PAUSED",
        };

        await reconcileSubscription({
          organizationId: orgId,
          provider: "stripe",
          providerCustomerId: sub.customer as string,
          providerSubId: sub.id,
          status: statusMap[sub.status] ?? "ACTIVE",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });

        await recordBillingEvent({
          organizationId: orgId,
          type: event.type === "customer.subscription.created" ? "SUBSCRIPTION_CREATED" : "SUBSCRIPTION_UPDATED",
          amountCents: 0,
          currency: "usd",
          provider: "stripe",
          providerEventId: event.id,
        });
        break;
      }

      case "customer.subscription.deleted": {
        await reconcileSubscription({
          organizationId: orgId,
          provider: "stripe",
          status: "CANCELED",
        });

        await recordBillingEvent({
          organizationId: orgId,
          type: "SUBSCRIPTION_CANCELED",
          amountCents: 0,
          currency: "usd",
          provider: "stripe",
          providerEventId: event.id,
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as { total?: number; id: string };
        await recordBillingEvent({
          organizationId: orgId,
          type: "INVOICE_PAID",
          amountCents: invoice.total ?? 0,
          currency: "usd",
          provider: "stripe",
          providerEventId: event.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as { total?: number; id: string };
        await recordBillingEvent({
          organizationId: orgId,
          type: "INVOICE_FAILED",
          amountCents: invoice.total ?? 0,
          currency: "usd",
          provider: "stripe",
          providerEventId: event.id,
        });
        break;
      }

      default:
        // Unhandled event type — acknowledge to prevent Stripe retries
        return NextResponse.json({ received: true, unhandled: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[STRIPE WEBHOOK ERROR]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
