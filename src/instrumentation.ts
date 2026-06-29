/**
 * Next.js instrumentation hook — runs once at server startup, in every worker.
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
 *   - NODE_OPTIONS='--dns-result-order=ipv4first' doesn't work because
 *     Turbopack worker threads don't inherit env vars
 *
 * This file is loaded by Next.js automatically on server startup.
 * No config flag needed in Next.js 16.
 */

export async function register() {
  // Always set IPv4-first — runs in both nodejs and edge runtimes
  // (the import is dynamic so edge runtime doesn't choke on node:dns)
  try {
    if (process.env.NEXT_RUNTIME !== "edge") {
      const dns = await import("node:dns");
      dns.setDefaultResultOrder("ipv4first");
      console.log("[instrumentation] DNS set to ipv4first ✅");
    }
  } catch (err) {
    console.error("[instrumentation] Failed to set DNS order:", err);
  }
}
