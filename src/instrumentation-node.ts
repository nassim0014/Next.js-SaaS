/**
 * DNS setup helper — loaded only in the Node.js runtime.
 *
 * This file is dynamically imported from instrumentation.ts so that
 * Turbopack's static analysis doesn't see node:dns when evaluating
 * instrumentation.ts for the Edge Runtime.
 */

import dns from "node:dns";

export function setupDns() {
  dns.setDefaultResultOrder("ipv4first");
  console.log("[instrumentation] DNS set to ipv4first ✅");
}
