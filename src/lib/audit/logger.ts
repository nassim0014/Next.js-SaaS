import { prisma, Prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";
import { headers } from "next/headers";

/**
 * Audit logger — fire-and-forget writes to AuditLog.
 *
 * Every mutation in the app calls `audit()` after success:
 *   1. Create a resource → audit("CREATE", "agent", agent.id)
 *   2. Update a resource → audit("UPDATE", "agent", agent.id, { before, after })
 *   3. Delete a resource → audit("DELETE", "agent", agent.id)
 *
 * The audit log is exposed at /settings/audit-log for org admins.
 */

type AuditInput = {
  organizationId?: string;
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  // Optional — auto-populated from request headers if not provided
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Write an audit log entry. Never throws — failures are logged but do not
 * block the caller's operation.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    let ipAddress: string | undefined = input.ipAddress;
    let userAgent: string | undefined = input.userAgent;

    if (!ipAddress || !userAgent) {
      const headerList = await headers();
      ipAddress ??= headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
      userAgent ??= headerList.get("user-agent") ?? undefined;
    }

    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    // Audit failures must NEVER block user-facing operations
    console.error("[AUDIT LOG FAILURE]", err);
  }
}

/**
 * Query the audit log with pagination + filtering.
 * Used by /settings/audit-log.
 */
export async function queryAuditLog(params: {
  organizationId: string;
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  limit?: number;
  cursor?: string;
}) {
  const limit = Math.min(params.limit ?? 50, 100);

  return prisma.auditLog.findMany({
    where: {
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(params.cursor
      ? { cursor: { id: params.cursor }, skip: 1 }
      : {}),
  });
}
