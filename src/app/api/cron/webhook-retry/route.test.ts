import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { NextRequest } from "next/server";

// getEventsForRetry feeds the loop; scheduleRetry is the backoff / permanent-
// failure scheduler. The bug this file regresses: the cron route updated the
// event to FAILED but never called scheduleRetry, so nextRetryAt kept its
// stale past value and the event was re-tried every 5 minutes forever.
const getEventsForRetryMock: Mock = vi.fn();
const scheduleRetryMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webhooks/retry", () => ({
  getEventsForRetry: (...a: unknown[]) => getEventsForRetryMock(...a),
  scheduleRetry: (...a: unknown[]) => scheduleRetryMock(...a),
}));

const findUniqueMock: Mock = vi.fn();
const updateMock: Mock = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEndpoint: { findUnique: (...a: unknown[]) => findUniqueMock(...a) },
    webhookEvent: { update: (...a: unknown[]) => updateMock(...a) },
  },
}));

vi.mock("@/lib/webhooks/signer", () => ({ signWebhook: () => "test-signature" }));

const { GET } = await import("@/app/api/cron/webhook-retry/route");

const CRON_SECRET = "cron-secret-for-tests"; // gitleaks:allow — test fixture

function cronRequest(auth: string = `Bearer ${CRON_SECRET}`): NextRequest {
  return new Request("https://app.test/api/cron/webhook-retry", {
    headers: { authorization: auth },
  }) as unknown as NextRequest;
}

const oneEvent = () => [
  { id: "evt-1", endpointId: "ep-1", eventType: "conversation.created", payload: {} },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  findUniqueMock.mockResolvedValue({
    id: "ep-1",
    url: "https://receiver.test/hook",
    secret: "endpoint-secret",
    isActive: true,
  });
});

describe("cron/webhook-retry", () => {
  it("rejects a request without the cron secret", async () => {
    getEventsForRetryMock.mockResolvedValue([]);
    const res = await GET(cronRequest("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(getEventsForRetryMock).not.toHaveBeenCalled();
  });

  it("schedules the next retry (backoff + permanent-failure cutoff) when an attempt gets a non-2xx", async () => {
    getEventsForRetryMock.mockResolvedValue(oneEvent());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch
    );

    await GET(cronRequest());

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({ status: "FAILED", attempts: { increment: 1 } }),
      })
    );
    // The regression guard: the event must be handed back to the scheduler.
    expect(scheduleRetryMock).toHaveBeenCalledWith("evt-1");
  });

  it("schedules the next retry when the delivery request throws (network error / timeout)", async () => {
    getEventsForRetryMock.mockResolvedValue(oneEvent());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) as unknown as typeof fetch
    );

    await GET(cronRequest());

    expect(scheduleRetryMock).toHaveBeenCalledWith("evt-1");
  });

  it("does NOT schedule another retry when the delivery finally succeeds", async () => {
    getEventsForRetryMock.mockResolvedValue(oneEvent());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch
    );

    const res = await GET(cronRequest());

    expect(scheduleRetryMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED", nextRetryAt: null }),
      })
    );
    const body = (await res.json()) as { succeeded: number };
    expect(body.succeeded).toBe(1);
  });

  it("skips inactive endpoints without touching the scheduler", async () => {
    getEventsForRetryMock.mockResolvedValue(oneEvent());
    findUniqueMock.mockResolvedValue({ id: "ep-1", url: "x", secret: "s", isActive: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await GET(cronRequest());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(scheduleRetryMock).not.toHaveBeenCalled();
  });
});
