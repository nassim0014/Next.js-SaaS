import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison to prevent timing attacks on secret checks.
 *
 * Use this for any comparison involving API keys, webhook secrets, auth
 * tokens, or CRON_SECRET. NEVER use `===` or `!==` for secret comparisons —
 * the comparison time leaks information about how many bytes match.
 *
 * @example
 *   if (!safeCompare(authHeader, `Bearer ${secret}`)) {
 *     return new Response("Unauthorized", { status: 401 });
 *   }
 *
 * @returns true if the strings are equal, false otherwise.
 *   Always runs in constant time relative to the longer string.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Different-length strings can't be equal, but we still call timingSafeEqual
  // on equal-length buffers to avoid leaking length info via timing.
  if (bufA.length !== bufB.length) {
    // Compare bufA against itself to burn the same amount of time
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
