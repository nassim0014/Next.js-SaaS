import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { KeyRound } from "lucide-react";
import { revokeApiKeyAction } from "./actions";
import { ApiKeyForm } from "./api-key-form";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const apiKeys = await prisma.apiKey.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">Programmatic access to your organization</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Key</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Keys ({apiKeys.filter((k) => k.status === "ACTIVE").length})</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <KeyRound className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No API keys yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a key to access the API programmatically</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{key.prefix}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {key.lastUsedAt && (
                      <span className="text-xs text-muted-foreground">Used {formatRelativeTime(key.lastUsedAt)}</span>
                    )}
                    <Badge variant={key.status === "ACTIVE" ? "default" : "secondary"}>{key.status}</Badge>
                    {key.status === "ACTIVE" && (
                      <form action={revokeApiKeyAction}>
                        <input type="hidden" name="id" value={key.id} />
                        <Button type="submit" size="sm" variant="outline">Revoke</Button>
                      </form>
                    )}
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
