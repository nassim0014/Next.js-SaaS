import { RoleName, Permission } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Permission map — the actions a role can perform.
 * Mirrors the `Permission` table (seeded by `prisma/seed.ts`).
 *
 * Format: "<domain>:<action>" — e.g., "conversations:create", "billing:manage"
 */

// Static fallback (used before DB is seeded). Mirrors the seed file.
export const DEFAULT_PERMISSIONS: Record<RoleName, string[]> = {
  OWNER: ["*"],
  ADMIN: [
    "agents:*",
    "conversations:*",
    "knowledge_base:*",
    "members:*",
    "members:invite",
    "billing:read",
    "billing:manage",
    "api_keys:*",
    "webhooks:*",
    "webhooks:create",
    "audit_log:read",
    "usage:read",
    "compliance:*",
  ],
  MEMBER: [
    "agents:read",
    "agents:create",
    "agents:update",
    "conversations:read",
    "conversations:create",
    "knowledge_base:read",
    "knowledge_base:upload",
    "usage:read",
    "api_keys:read",
    "api_keys:create",
  ],
  VIEWER: [
    "agents:read",
    "conversations:read",
    "knowledge_base:read",
    "usage:read",
    "audit_log:read",
  ],
};

/**
 * Check whether a role has a given permission.
 *
 * Supports glob-style wildcards:
 *   - "agents:*" matches "agents:create", "agents:read", etc.
 *   - "*" matches everything (OWNER only)
 *
 * @example
 *   hasPermission("ADMIN", "agents:create")  // true
 *   hasPermission("VIEWER", "agents:create") // false
 */
export function hasPermission(role: RoleName, requiredAction: string): boolean {
  const perms = DEFAULT_PERMISSIONS[role];
  return perms.some((p) => {
    if (p === "*") return true;
    if (p === requiredAction) return true;
    if (p.endsWith(":*")) {
      const domain = p.slice(0, -1); // "agents:*" → "agents:"
      return requiredAction.startsWith(domain);
    }
    return false;
  });
}

/**
 * Type-safe `can()` function — the primary entry point for RBAC checks.
 *
 * @example
 *   const session = await requireUser();
 *   const orgId = await getActiveOrgId();
 *   if (!can(session.user.role, "agents:create")) {
 *     throw new ForbiddenError("You cannot create agents");
 *   }
 */
export function can(role: RoleName, action: string): boolean {
  return hasPermission(role, action);
}

/**
 * Fetch the full permission set for a role from the DB (overrides static defaults).
 * Used in production after RBAC is seeded.
 */
export async function getRolePermissions(role: RoleName): Promise<Permission[]> {
  return prisma.permission.findMany({
    where: { roles: { some: { role } } },
  });
}
