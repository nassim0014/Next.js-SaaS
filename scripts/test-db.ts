/**
 * Diagnostic: test Prisma connection independently.
 *
 * Usage:
 *   pnpm tsx scripts/test-db.ts
 *
 * This script:
 *   1. Resolves the DB hostname and shows IPv4 vs IPv6
 *   2. Tests a raw TCP connection to the DB port
 *   3. Forces IPv4-first DNS
 *   4. Tests a Prisma query
 *
 * If step 4 succeeds after step 2/3, the fix is to set
 * dns.setDefaultResultOrder('ipv4first') in your app startup.
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

console.log("🔍 Database Connection Diagnostic");
console.log("==================================\n");

// 1. Show what env vars are loaded
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL not set. Run: source .env && pnpm tsx scripts/test-db.ts");
  process.exit(1);
}

// Parse the URL to extract hostname and port
const match = dbUrl.match(/@([^:]+):(\d+)/);
if (!match) {
  console.error("❌ Could not parse DATABASE_URL");
  process.exit(1);
}
const hostname = match[1];
const port = parseInt(match[2], 10);

console.log(`📍 Target: ${hostname}:${port}\n`);

// 2. Resolve DNS — show both IPv4 and IPv6
console.log("Step 1: DNS resolution");
const dns = require("node:dns").promises;

try {
  const addresses = await dns.lookup(hostname, { all: true });
  console.log(`   Resolved to ${addresses.length} address(es):`);
  for (const addr of addresses) {
    console.log(`   - ${addr.family === 6 ? "IPv6" : "IPv4"}: ${addr.address}`);
  }
} catch (err) {
  console.error(`   ❌ DNS lookup failed:`, err);
}

// 3. Test default DNS order (what Node.js does without our fix)
console.log("\nStep 2: Default DNS order (what Next.js does WITHOUT the fix)");
try {
  const addr = await dns.lookup(hostname);
  console.log(`   Default resolves to: ${addr.family === 6 ? "IPv6" : "IPv4"} ${addr.address}`);
  if (addr.family === 6) {
    console.log("   ⚠️  Default is IPv6 — this is the problem!");
    console.log("   Node.js will try IPv6 first, fail on networks without IPv6, and Prisma won't retry IPv4.");
  }
} catch (err) {
  console.error(`   ❌ Failed:`, err);
}

// 4. Force IPv4-first and test
console.log("\nStep 3: Force IPv4-first DNS");
const dnsSync = require("node:dns");
dnsSync.setDefaultResultOrder("ipv4first");
try {
  const addr = await dns.lookup(hostname);
  console.log(`   After fix resolves to: ${addr.family === 6 ? "IPv6" : "IPv4"} ${addr.address}`);
  if (addr.family === 4) {
    console.log("   ✅ Now IPv4 — good!");
  }
} catch (err) {
  console.error(`   ❌ Failed:`, err);
}

// 5. Test raw TCP connection
console.log(`\nStep 4: Raw TCP connection to ${hostname}:${port}`);
const net = require("node:net");

const canConnect = () =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", (err) => {
      resolve(false);
    });
    socket.connect(port, hostname);
  });

const connected = await canConnect();
if (connected) {
  console.log("   ✅ TCP connection succeeded — port is reachable");
} else {
  console.log("   ❌ TCP connection failed — port is blocked or unreachable");
  console.log("   Possible causes:");
  console.log("     - ISP/firewall blocking the port");
  console.log("     - IPv6-only resolution on a network without IPv6");
  console.log("     - Supabase project is paused");
}

// 6. Test Prisma query
console.log("\nStep 5: Prisma query test");
try {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });
  const count = await prisma.user.count();
  console.log(`   ✅ Prisma connected! User count: ${count}`);
  await prisma.$disconnect();
} catch (err) {
  console.error(`   ❌ Prisma failed:`, err instanceof Error ? err.message : err);
  console.error("\n   If step 4 succeeded but step 5 failed, the issue is Prisma-specific.");
  console.error("   If both failed, the issue is network-level.");
}

console.log("\n==================================");
console.log("Diagnostic complete.");
