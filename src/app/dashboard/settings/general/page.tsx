import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId, getUserOrganizations } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

async function updateOrgName(formData: FormData) {
  "use server";
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) throw new Error("NO_ACTIVE_ORG");

  const name = formData.get("name") as string;
  if (!name || name.length < 1) throw new Error("Name is required");

  await prisma.organization.update({
    where: { id: orgId },
    data: { name },
  });

  await audit({
    organizationId: orgId,
    userId: session.user.id,
    action: "UPDATE",
    resourceType: "organization",
    resourceId: orgId,
    metadata: { field: "name" },
  });

  revalidatePath("/dashboard/settings/general");
}

export default async function GeneralSettingsPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/dashboard");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      memberships: { include: { user: true }, where: { status: "ACTIVE" } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!org) redirect("/dashboard");

  const currentPlan = org.subscriptions[0]?.plan;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Settings</h1>
        <p className="text-muted-foreground">Manage your organization details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateOrgName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input id="name" name="name" defaultValue={org.name} required />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={org.slug} disabled />
              <p className="text-xs text-muted-foreground">Used in URLs — cannot be changed</p>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {currentPlan ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{currentPlan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {currentPlan.tokenQuota === -1
                    ? "Unlimited tokens"
                    : `${(currentPlan.tokenQuota / 1000).toFixed(0)}K tokens / month`}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href="/dashboard/settings/billing">Manage</a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active subscription</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({org.memberships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {org.memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.user.email}</span>
                <span className="text-muted-foreground">{m.role}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
