import crypto from "node:crypto";

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Used by lib/webhooks/dispatcher.ts when sending outbound webhooks.
 *
 * Receivers verify by re-computing the HMAC over the raw body.
 */

export function signWebhook(payload: string, secret: string = getSigningSecret()): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify a webhook signature. Constant-time comparison.
 *
 * @example
 *   const isValid = verifySignature(rawBody, signature, secret);
 *   if (!isValid) throw new Error("Invalid signature");
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string = getSigningSecret()
): boolean {
  const expected = signWebhook(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getSigningSecret(): string {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_SIGNING_SECRET not set");
  }
  return secret;
}
