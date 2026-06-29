import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId, setActiveOrgId } from "@/lib/auth/org-context";

/**
 * Switch the active organization for the current user.
 *
 * GET /api/org/switch?orgId=UUID  — sets the active-org-id cookie and redirects
 * POST /api/org/switch             — sets the cookie, returns JSON
 */

export async function GET(req: NextRequest) {
  await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  await setActiveOrgId(orgId);

  const redirect = req.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  return NextResponse.redirect(new URL(redirect, req.url));
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { orgId } = await req.json();
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    await setActiveOrgId(orgId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
