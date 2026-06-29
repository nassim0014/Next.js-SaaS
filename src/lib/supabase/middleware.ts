import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieOpts = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Refresh the Supabase session on every request, and update the auth cookies.
 * Called from `src/middleware.ts`.
 *
 * Returns the response with updated cookies. Pass `response` to next handler.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Skip session refresh during setup — let the app show a friendly error page
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieOpts[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Record<string, unknown>)
        );
      },
    },
  });

  // This will refresh the session if expired — required for Server Components
  await supabase.auth.getUser();

  return response;
}
