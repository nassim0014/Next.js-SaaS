import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE Supabase client. Bypasses RLS.
 *
 * ⚠️ SECURITY: Use ONLY on the server, and ONLY when you need to:
 *   - Insert into tables that have no RLS policy for the acting user
 *   - Run administrative queries (cron jobs, webhooks, GDPR exports)
 *   - Manage auth users programmatically
 *
 * NEVER import this into a Client Component. The service role key
 * must never appear in the browser bundle.
 */
let _admin: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _admin;
}
