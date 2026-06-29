import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * Sign out — clears the Supabase session and cookies.
 */
export async function POST() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete("active-org-id");

  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
