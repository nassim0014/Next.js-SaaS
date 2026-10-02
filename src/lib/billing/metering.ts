import { prisma } from "@/lib/prisma";
import { getCurrentPeriodUsage } from "@/lib/ai/cost";
import type { PlanSlug } from "./plans";

/**
 * Metering - read UsageRecord, enforce quotas, roll up daily/monthly.
 *
 * Called by /api/cron/usage-meter (runs nightly).
 */

/**
 * Roll up the current period's token usage into a UsageRecord.
 * Idempotent - uses a unique constraint on [organizationId, metric, periodStart].
 */
export async function rollupCurrentPeriod(organizationId: string): Promise<void> {
  const usage = await getCurrentPeriodUsage(organizationId);

  await prisma.usageRecord.upsert({
    where: {
      organizationId_metric_periodStart: {
        organizationId,
        metric: "tokens",
        periodStart: usage.periodStart,
      },
    },
    update: {
      value: usage.totalTokens,
    },
    create: {
      organizationId,
      metric: "tokens",
      value: usage.totalTokens,
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    },
  });
}

/**
 * Check if the org has exceeded its plan's token quota.
 * Used by the chat route to enforce per-request limits.
 */
export async function hasExceededQuota(
  organizationId: string,
  planSlug: PlanSlug
): Promise<boolean> {
  const usage = await getCurrentPeriodUsage(organizationId);
  const { PLANS } = await import("./plans");
  const plan = PLANS[planSlug];

  if (plan.tokenQuota === -1) return false;
  return usage.totalTokens >= plan.tokenQuota;
}

/**
 * Get quota usage as a percentage. Used by the /usage dashboard.
 */
export async function getQuotaPercentage(
  organizationId: string,
  planSlug: PlanSlug
): Promise<number> {
  const usage = await getCurrentPeriodUsage(organizationId);
  const { PLANS } = await import("./plans");
  const plan = PLANS[planSlug];

  if (plan.tokenQuota === -1) return 0; // Unlimited
  // A quota of 0 would otherwise divide by zero (NaN with no usage, Infinity
  // with any usage) instead of the clean 0-or-100 this function promises its
  // callers (the /usage dashboard). No seeded plan has tokenQuota: 0 today,
  // but nothing stops one being added.
  if (plan.tokenQuota === 0) return usage.totalTokens > 0 ? 100 : 0;
  return Math.min(100, Math.round((usage.totalTokens / plan.tokenQuota) * 100));
}
