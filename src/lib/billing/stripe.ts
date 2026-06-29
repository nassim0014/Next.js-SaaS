import Stripe from "stripe";

/**
 * Stripe client (server-only).
 *
 * Initialize lazily so the app doesn't crash on boot if STRIPE_SECRET_KEY is missing
 * (useful during local dev when only Supabase is set up).
 */
let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY not set. Add it to .env.local to enable billing."
    );
  }

  _stripe = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: {
      name: "Next.js SaaS Boilerplate",
      version: "1.0.0",
    },
  });

  return _stripe;
}

/**
 * Verify a Stripe webhook signature. Throws if invalid.
 *
 * @example
 *   const event = verifyStripeWebhookSignature(payload, signature);
 */
export function verifyStripeWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

  return stripe().webhooks.constructEvent(payload, signature, secret);
}
