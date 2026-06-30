import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { Download, Trash2, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const dataRequests = await prisma.dataRequest.findMany({
    where: { organizationId: orgId },
    orderBy: { requestedAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-muted-foreground">GDPR data export and right-to-erasure</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            GDPR Rights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium">Data Export (Right to Access)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Download all data associated with your account as a ZIP file. Includes conversations,
                  messages, usage records, and audit logs.
                </p>
                <Button className="mt-3" size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                  Request Export
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium">Delete Account (Right to Erasure)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                  Conversations, messages, and API keys will be hard-deleted. An audit record will be
                  retained for compliance.
                </p>
                <Button className="mt-3" size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Request Deletion
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {dataRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dataRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0 text-sm">
                  <div>
                    <p className="font-medium">{req.type}</p>
                    <p className="text-xs text-muted-foreground">Requested {formatRelativeTime(req.requestedAt)}</p>
                  </div>
                  <span className={`text-xs font-medium ${
                    req.status === "COMPLETED" ? "text-green-600" :
                    req.status === "FAILED" ? "text-red-600" :
                    "text-yellow-600"
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
