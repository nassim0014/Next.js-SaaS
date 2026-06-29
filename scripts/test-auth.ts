/**
 * Diagnostic: test Supabase Auth login directly.
 *
 * Usage:
 *   pnpm tsx scripts/test-auth.ts demo@example.com demo1234
 *
 * This bypasses our Next.js app and tests the credentials against
 * Supabase directly. If this fails, the credentials are wrong.
 * If this succeeds, the issue is in our app's Supabase client config.
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: pnpm tsx scripts/test-auth.ts <email> <password>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

console.log("🔍 Testing Supabase Auth login...");
console.log(`   URL:   ${supabaseUrl}`);
console.log(`   Email: ${email}`);
console.log(`   Key:   ${supabaseAnonKey.slice(0, 20)}...`);
console.log("");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error("❌ LOGIN FAILED");
  console.error(`   Code:    ${error.code ?? "unknown"}`);
  console.error(`   Message: ${error.message}`);
  console.error("");
  console.error("Possible causes:");
  console.error("  1. Password is wrong (recheck the Supabase dashboard)");
  console.error("  2. Email is not confirmed (disable 'Confirm email' in Auth → Providers)");
  console.error("  3. User doesn't exist in Supabase Auth (only exists in Prisma users table)");
  console.error("");
  console.error("To fix:");
  console.error("  1. Go to: https://supabase.com/dashboard/project/wptvsxvxvggezueegeik/auth/users");
  console.error("  2. Delete the demo@example.com user");
  console.error("  3. Go to: https://supabase.com/dashboard/project/wptvsxvxvggezueegeik/auth/providers");
  console.error("  4. Click 'Email' → turn OFF 'Confirm email' → Save");
  console.error("  5. Go back to Users → 'Add user' → email + password → check 'Auto Confirm' → Create");
  console.error("  6. Re-run this script with the new credentials");
  process.exit(1);
}

console.log("✅ LOGIN SUCCEEDED!");
console.log(`   User ID:    ${data.user?.id}`);
console.log(`   Email:      ${data.user?.email}`);
console.log(`   Confirmed:  ${data.user?.email_confirmed_at ?? "NOT CONFIRMED"}`);
console.log(`   Session:    ${data.session?.access_token ? "present" : "MISSING"}`);
console.log("");
console.log("The credentials work. The issue is in the Next.js app, not Supabase.");
