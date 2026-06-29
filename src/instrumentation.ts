/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * Forces Node.js to prefer IPv4 addresses when resolving DNS. This fixes
 * "Can't reach database server" errors on networks where IPv6 resolution
 * fails silently (common on many ISPs, especially in Africa/MENA regions).
 *
 * Why we need this:
 *   - Prisma CLI (Rust) resolves DNS via IPv4 — works
 *   - Prisma Node.js client uses Node's DNS, which tries IPv6 first
 *   - On networks without IPv6, the IPv6 attempt fails and Prisma doesn't
 *     retry with IPv4 → "Can't reach database server" error
 *   - NODE_OPTIONS='--dns-result-order=ipv4first' alone doesn't work
 *     reliably because Turbopack worker threads don't inherit env vars
 *
 * Implementation note: the actual node:dns import is in a separate file
 * (instrumentation-node.ts) so that Turbopack's static analysis doesn't
 * choke on node:dns when evaluating this file for the Edge Runtime.
 */

export async function register() {
  // Only run in the Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupDns } = await import("./instrumentation-node");
    setupDns();
  }
}
