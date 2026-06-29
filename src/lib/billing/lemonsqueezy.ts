import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

/**
 * Lemon Squeezy client setup (server-only).
 *
 * Lemon Squeezy is the Merchant of Record — they handle EU VAT, sales tax,
 * and compliance. Use them if you sell to EU customers and don't want to
 * register for VAT in every country.
 *
 * Unlike Stripe (which uses a class instance), Lemon Squeezy uses a global
 * setup function. Call `configureLemonSqueezy()` once at app boot.
 */
let _configured = false;

export function configureLemonSqueezy(): void {
  if (_configured) return;

  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) {
    throw new Error("LEMONSQUEEZY_API_KEY not set");
  }

  lemonSqueezySetup({
    apiKey: key,
    onError: (err) => console.error("[Lemon Squeezy]", err),
  });

  _configured = true;
}

/**
 * Verify a Lemon Squeezy webhook signature using HMAC-SHA256.
 *
 * @example
 *   const isValid = verifyLmsWebhookSignature(payload, signature);
 *   if (!isValid) throw new Error("Invalid signature");
 */
export function verifyLmsWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET not set");

  const crypto = require("node:crypto") as typeof import("node:crypto");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const digest = hmac.digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
