import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieOpts = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads the user's session from cookies.
 *
 * Authenticated — subject to RLS policies based on the user's JWT.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieOpts[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Record<string, unknown>)
          );
        } catch {
          // Called from a Server Component — safe to ignore, middleware refreshes session.
        }
      },
    },
  });
}
