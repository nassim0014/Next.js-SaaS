import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe";
import {
  recordBillingEvent,
  reconcileSubscription,
  markSubscriptionStatus,
  PlanNotFoundError,
} from "@/lib/billing/webhooks";
import { getPlanByStripePriceId } from "@/lib/billing/plans";
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
        // Stripe moved current_period_start/end OFF Subscription and ONTO
        // SubscriptionItem (API 2025-03-31 onward; see the stripe-node
        // CHANGELOG: "Remove support for current_period_end and
        // current_period_start on Subscription"). The billing period is now
        // per-item, so it is read from the item below.
        const sub = event.data.object as {
          id: string;
          customer: string;
          status: string;
          cancel_at_period_end: boolean;
          items: {
            data: Array<{
              price: { id: string };
              current_period_start: number;
              current_period_end: number;
            }>;
          };
        };

        const statusMap: Record<string, SubscriptionStatus> = {
          active: "ACTIVE",
          past_due: "PAST_DUE",
          canceled: "CANCELED",
          trialing: "TRIALING",
          paused: "PAUSED",
        };

        // Resolve which Plan this subscription is actually for from its
        // Stripe Price ID — never fall back to a guessed/default plan.
        // A subscription always has at least one item; if it does not, the
        // payload is malformed and there is no price to resolve a Plan from.
        const item = sub.items?.data?.[0];
        if (!item) {
          throw new PlanNotFoundError(
            `stripe subscription ${sub.id} (no subscription items in payload)`
          );
        }

        const priceId = item.price?.id;
        const plan = priceId ? await getPlanByStripePriceId(priceId) : null;
        if (!plan) {
          throw new PlanNotFoundError(
            `stripe subscription ${sub.id} (price ${priceId ?? "unknown"})`
          );
        }

        // Guard the period explicitly. `new Date(undefined * 1000)` is an
        // Invalid Date, which Prisma would happily persist — a subscription row
        // with a corrupt billing period fails silently and is only noticed when
        // renewal or entitlement checks start behaving strangely. Fail the
        // webhook instead so Stripe retries and the problem is visible.
        if (
          typeof item.current_period_start !== "number" ||
          typeof item.current_period_end !== "number"
        ) {
          throw new Error(
            `STRIPE_MISSING_PERIOD: subscription ${sub.id} item ${priceId} has no ` +
              `current_period_start/end. Since API 2025-03-31 these live on the ` +
              `subscription ITEM, not the subscription.`
          );
        }

        await reconcileSubscription({
          organizationId: orgId,
          planId: plan.id,
          provider: "stripe",
          providerCustomerId: sub.customer as string,
          providerSubId: sub.id,
          status: statusMap[sub.status] ?? "ACTIVE",
          currentPeriodStart: new Date(item.current_period_start * 1000),
          currentPeriodEnd: new Date(item.current_period_end * 1000),
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
        await markSubscriptionStatus({
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
