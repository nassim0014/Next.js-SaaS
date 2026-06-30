import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: orgId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  const billingEvents = await prisma.billingEvent.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const currentPlanSlug = subscription?.plan.slug as keyof typeof PLANS | undefined;
  const currentPlan = currentPlanSlug ? PLANS[currentPlanSlug] : PLANS.free;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and view billing history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{currentPlan.name}</p>
              <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
              {subscription && (
                <p className="text-xs text-muted-foreground mt-1">
                  Status: <Badge variant="secondary">{subscription.status}</Badge>
                  {subscription.currentPeriodEnd && (
                    <> · Renews {formatRelativeTime(subscription.currentPeriodEnd)}</>
                  )}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {currentPlan.priceMonthly === -1 ? "Custom" : formatCurrency(currentPlan.priceMonthly)}
              </p>
              <p className="text-xs text-muted-foreground">/month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((slug) => {
            const plan = PLANS[slug];
            const isCurrent = currentPlanSlug === slug;
            const priceLabel = plan.priceMonthly === -1 ? "Custom" : plan.priceMonthly === 0 ? "$0" : formatCurrency(plan.priceMonthly);
            return (
              <Card key={slug} className={plan.highlight ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {plan.highlight && <Badge>Popular</Badge>}
                  </div>
                  <div className="text-2xl font-bold">
                    {priceLabel}
                    {plan.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-1">
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-4" variant={isCurrent ? "outline" : "default"} disabled={isCurrent}>
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {billingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Billing Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {billingEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0 text-sm">
                  <div>
                    <p className="font-medium">{e.type.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(e.createdAt)}</p>
                  </div>
                  <span className="font-medium">
                    {e.amountCents > 0 ? formatCurrency(e.amountCents) : "—"}
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
