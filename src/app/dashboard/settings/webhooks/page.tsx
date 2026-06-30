import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { Plus, Webhook } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Outbound webhook endpoints for event delivery</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Add Endpoint
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints ({endpoints.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {endpoints.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No webhook endpoints yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add an endpoint to receive event notifications when things happen in your org
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div key={ep.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-xs">{ep.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {ep.events.length} events · {ep._count.deliveries} deliveries
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(ep.createdAt)}</span>
                    <Badge variant={ep.isActive ? "default" : "secondary"}>
                      {ep.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
