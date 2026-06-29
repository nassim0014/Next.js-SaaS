import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { getCurrentPeriodUsage } from "@/lib/ai/cost";
import { formatCost, formatTokenCount } from "@/lib/utils";

export default async function UsagePage() {
  await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const usage = await getCurrentPeriodUsage(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage & Cost</h1>
        <p className="text-muted-foreground">
          Real-time AI cost observability — every LLM call metered to the cent.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Tokens Used (period)</CardDescription>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokenCount(usage.totalTokens)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {usage.periodStart.toLocaleDateString()} → {usage.periodEnd.toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Cost (period)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(usage.totalCostUsd)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed via your subscription plan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billing Period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {usage.periodStart.toLocaleDateString()} - {usage.periodEnd.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily breakdown</CardTitle>
          <CardDescription>
            Token usage + cost over the last 30 days (chart coming in v1.1)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm border rounded-md">
            📊 Daily usage chart will render here. Powered by `getDailyUsageBreakdown()`.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
