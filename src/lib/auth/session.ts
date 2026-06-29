import { supabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type AppSession = {
  user: SessionUser;
  supabaseUser: User;
};

/**
 * Get the current user from the Supabase session.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<AppSession | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Sync to Prisma (idempotent — created on first login via Supabase webhook)
  const dbUser = await prisma.user.upsert({
    where: { email: user.email ?? "" },
    update: {
      lastLoginAt: new Date(),
      emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
    },
    create: {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
      lastLoginAt: new Date(),
    },
  });

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
    },
    supabaseUser: dbUser,
  };
}

/**
 * Require an authenticated user. Throws if not logged in.
 * Use in Server Components and Server Actions.
 */
export async function requireUser(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

/**
 * Require an authenticated user with a specific permission.
 * Throws if not authorized.
 *
 * @example
 *   const session = await requireUserWithPermission(orgId, "agents:create");
 */
export async function requireUserWithPermission(
  orgId: string,
  action: string
): Promise<{ session: AppSession; role: import("@prisma/client").RoleName }> {
  const session = await requireUser();
  const { getOrgMembership } = await import("./org-context");
  const membership = await getOrgMembership(session.user.id, orgId);

  if (!membership) {
    throw new Error("FORBIDDEN: not a member of this organization");
  }

  const { can } = await import("./permissions");
  if (!can(membership.role, action)) {
    throw new Error(`FORBIDDEN: missing permission ${action}`);
  }

  return { session, role: membership.role };
}
