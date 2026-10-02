import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * metering.ts has three functions on the billing hot path (rollupCurrentPeriod,
 * hasExceededQuota, getQuotaPercentage) and, until this file, zero test coverage.
 * All three are pure wrappers around
 * getCurrentPeriodUsage() + the PLANS table, so both are mocked here rather than
 * hitting a real DB.
 */

const upsertMock = vi.fn().mockResolvedValue(undefined);
const getCurrentPeriodUsageMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usageRecord: {
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

vi.mock("@/lib/ai/cost", () => ({
  getCurrentPeriodUsage: (...args: unknown[]) => getCurrentPeriodUsageMock(...args),
}));

const { rollupCurrentPeriod, hasExceededQuota, getQuotaPercentage } = await import(
  "@/lib/billing/metering"
);
type PlanSlug = Parameters<typeof hasExceededQuota>[1];

const PERIOD_START = new Date("2026-01-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-01-31T23:59:59.999Z");

function usage(totalTokens: number) {
  return {
    totalTokens,
    totalCostUsd: 0,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  };
}

beforeEach(() => {
  upsertMock.mockClear();
  getCurrentPeriodUsageMock.mockReset();
});

describe("billing/metering rollupCurrentPeriod", () => {
  it("upserts the UsageRecord keyed by organizationId_metric_periodStart with the summed tokens", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(1234));

    await rollupCurrentPeriod("org-1");

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0]![0];
    expect(call.where.organizationId_metric_periodStart).toEqual({
      organizationId: "org-1",
      metric: "tokens",
      periodStart: PERIOD_START,
    });
    expect(call.update.value).toBe(1234);
    expect(call.create).toEqual({
      organizationId: "org-1",
      metric: "tokens",
      value: 1234,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
  });

  it("is idempotent for the same org + period - calling it twice re-upserts rather than duplicating", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(10));
    await rollupCurrentPeriod("org-1");
    getCurrentPeriodUsageMock.mockResolvedValue(usage(20));
    await rollupCurrentPeriod("org-1");

    expect(upsertMock).toHaveBeenCalledTimes(2);
    // Same unique-constraint key both times - an upsert, not an insert.
    expect(upsertMock.mock.calls[0]![0].where).toEqual(upsertMock.mock.calls[1]![0].where);
    expect(upsertMock.mock.calls[1]![0].update.value).toBe(20);
  });
});

describe("billing/metering hasExceededQuota", () => {
  it("returns false when usage is below the plan's quota", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(499_999));
    expect(await hasExceededQuota("org-1", "starter")).toBe(false);
  });

  it("returns true exactly at quota - the boundary is inclusive (>=)", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(500_000));
    expect(await hasExceededQuota("org-1", "starter")).toBe(true);
  });

  it("returns true once usage is above quota", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(600_000));
    expect(await hasExceededQuota("org-1", "starter")).toBe(true);
  });

  it("never reports exceeded for an unlimited (-1 tokenQuota) plan", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(50_000_000));
    expect(await hasExceededQuota("org-1", "enterprise")).toBe(false);
  });
});

describe("billing/metering getQuotaPercentage", () => {
  it("computes a rounded percentage of quota used", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(250_000));
    expect(await getQuotaPercentage("org-1", "starter")).toBe(50); // 250k / 500k
  });

  it("rounds to the nearest whole percent", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(166_667));
    expect(await getQuotaPercentage("org-1", "starter")).toBe(33); // 33.33%
  });

  it("caps at 100 once usage exceeds quota", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(750_000));
    expect(await getQuotaPercentage("org-1", "starter")).toBe(100);
  });

  it("returns 0 for an unlimited (-1 tokenQuota) plan regardless of usage", async () => {
    getCurrentPeriodUsageMock.mockResolvedValue(usage(999_999_999));
    expect(await getQuotaPercentage("org-1", "enterprise")).toBe(0);
  });

  it("does not divide by zero for a plan with tokenQuota === 0 - returns a clean 0 or 100", async () => {
    // Regression: Math.round((n / 0) * 100) is
    // Infinity (n > 0) or NaN (n === 0) in plain JS, not the clean 0-or-100
    // contract this function promises its callers (the /usage dashboard).
    // No seeded plan currently has tokenQuota: 0, so this is reached only via
    // a cast - exactly how a future zero-quota plan would reach it too.
    const zeroQuotaSlug = "zero-quota-test-plan" as unknown as PlanSlug;
    vi.doMock("@/lib/billing/plans", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/billing/plans")>();
      return {
        ...actual,
        PLANS: {
          ...actual.PLANS,
          "zero-quota-test-plan": { ...actual.PLANS.starter, tokenQuota: 0 },
        },
      };
    });
    vi.resetModules();
    const { getQuotaPercentage: getQuotaPercentageFresh } = await import(
      "@/lib/billing/metering"
    );

    getCurrentPeriodUsageMock.mockResolvedValue(usage(0));
    expect(await getQuotaPercentageFresh("org-1", zeroQuotaSlug)).toBe(0);

    getCurrentPeriodUsageMock.mockResolvedValue(usage(42));
    expect(await getQuotaPercentageFresh("org-1", zeroQuotaSlug)).toBe(100);

    vi.doUnmock("@/lib/billing/plans");
    vi.resetModules();
  });
});
