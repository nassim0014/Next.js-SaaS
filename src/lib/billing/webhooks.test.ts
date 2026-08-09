import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn().mockResolvedValue(undefined);
const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: (...args: unknown[]) => upsertMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
    billingEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  Prisma: { JsonNull: null },
}));

const { reconcileSubscription, markSubscriptionStatus, PlanNotFoundError } = await import(
  "@/lib/billing/webhooks"
);

describe("billing/webhooks reconcileSubscription", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    updateManyMock.mockClear();
  });

  it("passes the real planId into both the create and update branches of the upsert", async () => {
    await reconcileSubscription({
      organizationId: "org-1",
      planId: "plan-pro-real-uuid",
      provider: "stripe",
      status: "ACTIVE",
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0][0];

    // The bug this regresses: create used to hardcode planId: "default-plan-id"
    // regardless of what was actually purchased.
    expect(call.create.planId).toBe("plan-pro-real-uuid");
    expect(call.update.planId).toBe("plan-pro-real-uuid");
    expect(call.create.planId).not.toBe("default-plan-id");
  });

  it("scopes the upsert to organizationId + provider", async () => {
    await reconcileSubscription({
      organizationId: "org-2",
      planId: "plan-starter-uuid",
      provider: "lemonsqueezy",
      status: "TRIALING",
    });

    const call = upsertMock.mock.calls[0][0];
    expect(call.where.organizationId_provider).toEqual({
      organizationId: "org-2",
      provider: "lemonsqueezy",
    });
  });
});

describe("billing/webhooks markSubscriptionStatus", () => {
  beforeEach(() => {
    updateManyMock.mockClear();
  });

  it("updates status without requiring or touching a planId", async () => {
    await markSubscriptionStatus({
      organizationId: "org-1",
      provider: "stripe",
      status: "CANCELED",
    });

    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const call = updateManyMock.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId: "org-1", provider: "stripe" });
    expect(call.data.status).toBe("CANCELED");
    expect(call.data).not.toHaveProperty("planId");
  });
});

describe("billing/webhooks PlanNotFoundError", () => {
  it("carries a recognizable name and message for the webhook route to log", () => {
    const err = new PlanNotFoundError("stripe subscription sub_123 (price price_456)");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PlanNotFoundError");
    expect(err.message).toContain("PLAN_NOT_FOUND_FOR_PRICE");
    expect(err.message).toContain("sub_123");
  });
});
