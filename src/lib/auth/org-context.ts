import { prisma } from "@/lib/prisma";
import type { Membership, RoleName } from "@prisma/client";
import { cookies } from "next/headers";

const ACTIVE_ORG_COOKIE = "active-org-id";

/**
 * Get the active organization ID for the current request.
 * Resolved from the `active-org-id` cookie, set by /api/org/switch.
 *
 * In production, you can also resolve from subdomain (e.g., acme.app.com → org "acme").
 */
export async function getActiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

/**
 * Set the active org cookie. Call from a Server Action or Route Handler.
 */
export async function setActiveOrgId(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

/**
 * Get the user's membership in a specific organization.
 * Returns null if the user is not a member.
 */
export async function getOrgMembership(
  userId: string,
  orgId: string
): Promise<(Membership & { role: RoleName }) | null> {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: orgId },
    },
  });

  if (!membership || membership.status !== "ACTIVE") return null;
  return membership as Membership & { role: RoleName };
}

/**
 * Get all organizations the user is a member of.
 */
export async function getUserOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { organization: true },
  });
}

/**
 * Require an active org. Throws if the user has no active org selected.
 * Use in (app) routes.
 */
export async function requireActiveOrgId(): Promise<string> {
  const orgId = await getActiveOrgId();
  if (!orgId) {
    throw new Error("NO_ACTIVE_ORG");
  }
  return orgId;
}
