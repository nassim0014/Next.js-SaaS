import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { Webhook, Trash2, AlertCircle } from "lucide-react";
import { deleteWebhookAction } from "./actions";
import { WebhookForm } from "./webhook-form";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { deliveries: true } },
      deliveries: {
        where: { status: "FAILED" },
        select: { id: true, eventType: true, attempts: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalFailed = endpoints.reduce((sum, ep) => sum + ep.deliveries.length, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground">Outbound webhook endpoints for event delivery</p>
      </div>

      {totalFailed > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {totalFailed} Permanently Failed {totalFailed === 1 ? "Delivery" : "Deliveries"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These events exceeded the maximum retry count and will not be re-attempted. Review the endpoint configuration or check server logs.
            </p>
            <div className="space-y-2">
              {endpoints
                .filter((ep) => ep.deliveries.length > 0)
                .flatMap((ep) =>
                  ep.deliveries.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <span className="font-medium">{d.eventType}</span>
                        <span className="text-muted-foreground ml-2">→ {ep.url}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Failed</Badge>
                        <span className="text-xs text-muted-foreground">{d.attempts} attempts</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(d.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Endpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <WebhookForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints ({endpoints.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {endpoints.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No webhook endpoints yet</p>
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
                    <form action={deleteWebhookAction}>
                      <input type="hidden" name="id" value={ep.id} />
                      <Button type="submit" size="sm" variant="outline">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </form>
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
