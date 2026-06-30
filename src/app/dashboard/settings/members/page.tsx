import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const invitations = await prisma.invitation.findMany({
    where: { organizationId: orgId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">Manage who has access to this organization</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Invite
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Members ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {m.user.email[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.user.email}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatRelativeTime(m.createdAt)}</p>
                  </div>
                </div>
                <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{m.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">Invited {formatRelativeTime(inv.createdAt)}</p>
                  </div>
                  <Badge variant="outline">{inv.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
