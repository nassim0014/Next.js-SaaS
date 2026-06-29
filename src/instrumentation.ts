/**
 * Next.js instrumentation hook — runs once at server startup, in every worker.
 *
 * Forces Node.js to prefer IPv4 addresses when resolving DNS. This fixes
 * "Can't reach database server" errors on networks without IPv6 support
 * (common on many ISPs, especially in Africa/MENA regions).
 *
 * Without this, Node.js tries IPv6 first → fails → Prisma doesn't retry
 * with IPv4 → "Can't reach database server" error. The Prisma CLI (Rust)
 * doesn't have this problem because it resolves DNS differently.
 *
 * NODE_OPTIONS='--dns-result-order=ipv4first' doesn't work because
 * Turbopack's worker threads don't inherit environment variables.
 */

export async function register() {
  // Only run on the server (not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
    console.log("[instrumentation] DNS set to ipv4first");
  }
}
