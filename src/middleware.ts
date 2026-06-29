import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware — runs on every request.
 *
 * 1. Refreshes the Supabase auth session (cookies)
 * 2. Allows public routes through
 * 3. Does NOT do auth checks here — that's handled by requireUser() in the
 *    layout/route. Why? Because @supabase/ssr uses chunked cookies with
 *    dynamic names (sb-<project-ref>-auth-token.0, .1, ...), so checking
 *    for a specific cookie name is unreliable.
 *
 * Public routes: marketing pages, login, signup, webhooks, health, cron
 * Protected routes: /dashboard, /settings, /api/* (except public ones)
 *    — these call requireUser() which uses supabase.auth.getUser()
 *    — the server-side Supabase client reads all chunked cookies correctly
 */

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/pricing", "/about", "/blog"];
const PUBLIC_ROUTE_PATTERNS = [
  /^\/api\/webhooks\//, // Webhook receivers (verified by signature, not session)
  /^\/api\/health/, // Health checks
  /^\/api\/cron\//, // Cron (verified by CRON_SECRET header)
  /^\/api\/auth\//, // Auth callbacks
  /^\/blog\//,
  /^\/docs\//,
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export async function middleware(request: NextRequest) {
  // Refresh the Supabase session (handles chunked cookies correctly)
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return response;
  }

  // For protected routes, we do NOT check auth here.
  // The layout's requireUser() handles it properly using supabase.auth.getUser(),
  // which reads all chunked cookies. If unauthorized, it redirects to /login.
  //
  // Why not check here? Because @supabase/ssr stores the session in chunked
  // cookies with names like sb-<ref>-auth-token.0, .1, etc. Manually checking
  // for "sb-access-token" (the old non-SSR name) always returns undefined,
  // causing a false redirect to /login even when the user IS authenticated.

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
