import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-green-600",
  UPDATE: "text-blue-600",
  DELETE: "text-red-600",
  LOGIN: "text-gray-600",
  LOGOUT: "text-gray-600",
  EXPORT: "text-yellow-600",
  INVITE: "text-purple-600",
  ROLE_CHANGE: "text-orange-600",
  API_KEY_USED: "text-cyan-600",
};

export default async function AuditLogPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Immutable record of all actions in this organization</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No audit events yet</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 border-b py-2 last:border-0 text-sm"
                >
                  <span className={`font-medium ${ACTION_COLORS[log.action] ?? "text-muted-foreground"} w-28 shrink-0`}>
                    {log.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground">{log.resourceType}</span>
                    {log.resourceId && (
                      <span className="text-xs text-muted-foreground ml-2 font-mono">
                        {log.resourceId.slice(0, 8)}
                      </span>
                    )}
                    {log.ipAddress && (
                      <span className="text-xs text-muted-foreground ml-2">{log.ipAddress}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
