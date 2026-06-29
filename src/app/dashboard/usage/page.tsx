import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, DollarSign, TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import {
  getCurrentPeriodUsage,
  getDailyUsageBreakdown,
  getModelUsageBreakdown,
} from "@/lib/ai/cost";
import { formatCost, formatTokenCount } from "@/lib/utils";
import { DailyUsageChart, ModelBreakdownChart } from "@/components/usage/usage-charts";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const [usage, dailyBreakdown, modelBreakdown] = await Promise.all([
    getCurrentPeriodUsage(orgId),
    getDailyUsageBreakdown(orgId, startDate, endDate),
    getModelUsageBreakdown(orgId, startDate, endDate),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage & Cost</h1>
        <p className="text-muted-foreground">
          Real-time AI cost observability — every LLM call metered to the cent.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
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
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Estimated Cost (period)</CardDescription>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(usage.totalCostUsd)}</div>
            <p className="text-xs text-muted-foreground mt-1">Billed via your subscription</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Avg Cost / 1K Tokens</CardDescription>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage.totalTokens > 0
                ? formatCost((usage.totalCostUsd / usage.totalTokens) * 1000)
                : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all models</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily usage chart ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Usage & Cost
          </CardTitle>
          <CardDescription>Last 30 days — tokens (left axis) and cost (right axis)</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyUsageChart data={dailyBreakdown} />
        </CardContent>
      </Card>

      {/* ── Model breakdown ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Token Distribution by Model
            </CardTitle>
            <CardDescription>Which models consume your token budget</CardDescription>
          </CardHeader>
          <CardContent>
            <ModelBreakdownChart data={modelBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Models by Cost</CardTitle>
            <CardDescription>Highest-cost models this period</CardDescription>
          </CardHeader>
          <CardContent>
            {modelBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No model usage yet. Send a chat message to see breakdown.
              </p>
            ) : (
              <div className="space-y-3">
                {[...modelBreakdown]
                  .sort((a, b) => b.costUsd - a.costUsd)
                  .slice(0, 5)
                  .map((m) => (
                    <div key={m.modelConfigId} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{m.modelName}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {m.provider} · {m.requestCount} requests · {formatTokenCount(m.tokens)} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCost(m.costUsd)}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.tokens > 0 ? formatCost((m.costUsd / m.tokens) * 1000) : "$0.00"}/1K
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
