import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getUserOrganizations } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { audit } from "@/lib/audit/logger";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createOrg(formData: FormData) {
  "use server";
  const session = await requireUser();
  const name = formData.get("name") as string;
  const slug = (formData.get("slug") as string || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "");

  if (!name || name.length < 1) {
    throw new Error("Organization name is required");
  }

  // Check slug uniqueness
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    throw new Error("This slug is already taken. Please choose another.");
  }

  // Create org + owner membership
  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      },
      // Create trial subscription
      subscriptions: {
        create: {
          plan: { connect: { slug: "free" } },
          status: "TRIALING",
          provider: "none",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      },
    },
  });

  await audit({
    organizationId: org.id,
    userId: session.user.id,
    action: "CREATE",
    resourceType: "organization",
    resourceId: org.id,
    metadata: { name, slug },
  });

  revalidatePath("/dashboard");
  redirect(`/api/org/switch?orgId=${org.id}&redirect=/dashboard`);
}

export default async function OnboardingPage() {
  const session = await requireUser();
  const orgs = await getUserOrganizations(session.user.id);

  // If the user already has an org, redirect to dashboard
  if (orgs.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to your new workspace</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first organization to get started
          </p>
        </CardHeader>
        <CardContent>
          <form action={createOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme Inc."
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug (optional)</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="acme"
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs. Defaults to a slugified version of the name.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Create Organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
