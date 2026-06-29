import { RoleName } from "@prisma/client";
import { can } from "./permissions";

/**
 * Re-export `can()` from rbac.ts for ergonomic imports.
 *
 * @example
 *   import { can } from "@/lib/auth/rbac";
 *   if (!can(role, "agents:create")) throw new Forbidden();
 */
export { can, hasPermission } from "./permissions";
export type { RoleName } from "@prisma/client";
export { DEFAULT_PERMISSIONS } from "./permissions";

/**
 * Helper: throw a typed Forbidden error if the user lacks a permission.
 */
export class ForbiddenError extends Error {
  constructor(public action: string) {
    super(`Forbidden: missing permission "${action}"`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: RoleName, action: string): void {
  if (!can(role, action)) {
    throw new ForbiddenError(action);
  }
}
