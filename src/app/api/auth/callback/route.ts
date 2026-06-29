import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Supabase OAuth callback handler.
 *
 * Exchanges the `code` param for a session, then redirects to the original page
 * (or /dashboard if no redirect was specified).
 */

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const redirect = req.nextUrl.searchParams.get("redirect") ?? "/dashboard";

  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(redirect, req.url));
}
