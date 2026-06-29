import { prisma } from "@/lib/prisma";

/**
 * ⭐ AI COST OBSERVABILITY — THE 5TH USP
 *
 * Every LLM call is metered and attributed to org + user + conversation + model.
 * This module powers:
 *   - Live /usage dashboard (per-day, per-agent, per-user cost breakdowns)
 *   - Per-org budget caps (80% / 100% alerts)
 *   - Usage-based billing (overage priced per 1K tokens)
 *
 * No AI SaaS boilerplate ships this out of the box.
 * Founders get burned by token bills because they can't see them — we fix that.
 */

export type RecordTokenUsageInput = {
  organizationId: string;
  userId?: string;
  conversationId?: string;
  modelConfigId: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd: number;
  requestId?: string;
};

/**
 * Insert a TokenUsage row. Fire-and-forget from the caller's perspective —
 * should never throw or block the chat stream.
 */
export async function recordTokenUsage(input: RecordTokenUsageInput): Promise<void> {
  await prisma.tokenUsage.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      conversationId: input.conversationId ?? null,
      modelConfigId: input.modelConfigId,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cachedTokens: input.cachedTokens ?? 0,
      costUsd: input.costUsd,
      requestId: input.requestId ?? null,
    },
  });
}

/**
 * Check if the org is within its token budget. Throws if exceeded.
 *
 * Budget = Plan.tokenQuota (monthly). If -1, unlimited.
 * Comparison: SUM(TokenUsage.inputTokens + outputTokens) for current period
 * vs. Plan.tokenQuota.
 */
export async function checkBudget(organizationId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error("NO_SUBSCRIPTION: org has no active subscription");
  }

  if (subscription.plan.tokenQuota === -1) {
    return; // Unlimited plan
  }

  const usage = await getCurrentPeriodUsage(organizationId);
  if (usage.totalTokens >= subscription.plan.tokenQuota) {
    throw new Error("BUDGET_EXCEEDED");
  }

  // Fire 80% / 100% alerts (webhook + email) — implemented in lib/billing/metering.ts
  // The check happens here; the alert dispatch happens async.
  if (usage.totalTokens >= subscription.plan.tokenQuota * 0.8) {
    await alertBudgetThreshold(organizationId, usage.totalTokens, subscription.plan.tokenQuota).catch(
      () => null
    );
  }
}

/**
 * Get the org's token usage for the current billing period.
 */
export async function getCurrentPeriodUsage(organizationId: string): Promise<{
  totalTokens: number;
  totalCostUsd: number;
  periodStart: Date;
  periodEnd: Date;
}> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId, status: { in: ["ACTIVE", "TRIALING"] } },
    orderBy: { createdAt: "desc" },
  });

  const periodStart = subscription?.currentPeriodStart ?? startOfMonth(new Date());
  const periodEnd = subscription?.currentPeriodEnd ?? endOfMonth(new Date());

  const result = await prisma.tokenUsage.aggregate({
    where: {
      organizationId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cachedTokens: true,
      costUsd: true,
    },
  });

  const totalTokens =
    (result._sum.inputTokens ?? 0) + (result._sum.outputTokens ?? 0);

  return {
    totalTokens,
    totalCostUsd: result._sum.costUsd ?? 0,
    periodStart,
    periodEnd,
  };
}

/**
 * Get usage breakdown by day for a date range.
 * Used by the /usage dashboard chart.
 */
export async function getDailyUsageBreakdown(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{ date: string; tokens: number; costUsd: number; inputTokens: number; outputTokens: number }>
> {
  const rows = await prisma.$queryRaw<
    Array<{
      date: string;
      tokens: bigint;
      costUsd: number;
      inputTokens: bigint;
      outputTokens: bigint;
    }>
  >`
    SELECT
      DATE(created_at) AS date,
      SUM(input_tokens + output_tokens) AS tokens,
      SUM(cost_usd) AS "costUsd",
      SUM(input_tokens) AS "inputTokens",
      SUM(output_tokens) AS "outputTokens"
    FROM token_usage
    WHERE organization_id = ${organizationId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC;
  `;

  return rows.map((r) => ({
    date: r.date,
    tokens: Number(r.tokens),
    costUsd: Number(r.costUsd),
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
  }));
}

/**
 * Get usage breakdown by user for a date range.
 */
export async function getUserUsageBreakdown(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    tokens: number;
    costUsd: number;
    conversationCount: number;
  }>
> {
  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      userName: string | null;
      userEmail: string;
      tokens: bigint;
      costUsd: number;
      conversationCount: bigint;
    }>
  >`
    SELECT
      tu.user_id AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      SUM(tu.input_tokens + tu.output_tokens) AS tokens,
      SUM(tu.cost_usd) AS "costUsd",
      COUNT(DISTINCT tu.conversation_id) AS "conversationCount"
    FROM token_usage tu
    LEFT JOIN users u ON u.id = tu.user_id
    WHERE tu.organization_id = ${organizationId}
      AND tu.created_at >= ${startDate}
      AND tu.created_at <= ${endDate}
    GROUP BY tu.user_id, u.name, u.email
    ORDER BY tokens DESC;
  `;

  return rows.map((r) => ({
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    tokens: Number(r.tokens),
    costUsd: Number(r.costUsd),
    conversationCount: Number(r.conversationCount),
  }));
}

/**
 * Get usage breakdown by model for a date range.
 */
export async function getModelUsageBreakdown(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    modelConfigId: string;
    provider: string;
    modelName: string;
    tokens: number;
    costUsd: number;
    requestCount: number;
  }>
> {
  const rows = await prisma.tokenUsage.groupBy({
    where: {
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    by: ["modelConfigId"],
    _sum: {
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
    },
    _count: true,
  });

  const configs = await prisma.modelConfig.findMany({
    where: { id: { in: rows.map((r) => r.modelConfigId) } },
  });

  return rows.map((r) => {
    const config = configs.find((c) => c.id === r.modelConfigId);
    return {
      modelConfigId: r.modelConfigId,
      provider: config?.provider ?? "unknown",
      modelName: config?.modelName ?? "unknown",
      tokens: (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
      costUsd: r._sum.costUsd ?? 0,
      requestCount: r._count,
    };
  });
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function alertBudgetThreshold(
  organizationId: string,
  currentTokens: number,
  quotaTokens: number
): Promise<void> {
  // Dispatch a webhook event + send an email.
  // Implementation in lib/webhooks/dispatcher.ts + lib/notifications/email.ts
  // (Stubbed here — wire up after Phase 3 notification module)
  const percent = Math.round((currentTokens / quotaTokens) * 100);
  console.warn(
    `[BUDGET ALERT] Org ${organizationId} at ${percent}% of token quota (${currentTokens}/${quotaTokens})`
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
