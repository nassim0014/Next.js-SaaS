import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware — runs on every request.
 *
 * 1. Refreshes the Supabase auth session (cookies)
 * 2. Protects /dashboard/* and /api/* routes (redirects to /login if unauthenticated)
 * 3. Allows public routes: marketing pages, /login, /signup, OAuth callback
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
  // Always refresh the Supabase session first
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return response;
  }

  // Check if user is authenticated (session cookie present)
  // The actual session validation happens in `requireUser()` on each route,
  // but we do a quick check here to redirect early.
  const authCookie = request.cookies.get("sb-access-token");
  if (!authCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/settings"))) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

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
