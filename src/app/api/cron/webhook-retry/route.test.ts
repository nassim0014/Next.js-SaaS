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

  it("delivers with bounded concurrency instead of one event at a time", async () => {
    // Regression guard for the "50 events x 10s timeout = up to 500s wall
    // time" problem: a sequential loop can only ever have 1 fetch in flight,
    // so this test fails against the pre-fix implementation (maxInFlight
    // would be 1). It also asserts the concurrency is *bounded* — fully
    // unbounded fan-out is its own risk when many events can share an
    // endpoint/org.
    const N = 25;
    getEventsForRetryMock.mockResolvedValue(
      Array.from({ length: N }, (_, i) => ({
        id: `evt-${i}`,
        endpointId: "ep-1",
        eventType: "conversation.created",
        payload: {},
      }))
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return { ok: true, status: 200 };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await GET(cronRequest());

    expect(fetchMock).toHaveBeenCalledTimes(N);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });

  it("keeps the retried/succeeded counters correct under concurrent processing", async () => {
    const events = [
      { id: "evt-ok", endpointId: "ep-1", eventType: "x", payload: {} },
      { id: "evt-fail", endpointId: "ep-1", eventType: "x", payload: {} },
      { id: "evt-throw", endpointId: "ep-1", eventType: "x", payload: {} },
    ];
    getEventsForRetryMock.mockResolvedValue(events);

    const fetchMock = vi.fn().mockImplementation((url, opts) => {
      const body = JSON.parse((opts as { body: string }).body) as { payload: unknown };
      void body;
      return Promise.resolve({ ok: true, status: 200 });
    });
    // Route the three events to three different outcomes via call order.
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockRejectedValueOnce(new Error("ETIMEDOUT"));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const res = await GET(cronRequest());
    const body = (await res.json()) as { retried: number; succeeded: number };

    // 1 response ok + 1 response non-ok both count toward "retried" (a
    // response was obtained); the thrown/timed-out one does not — matching
    // the pre-existing counter semantics this refactor must not change.
    expect(body.retried).toBe(2);
    expect(body.succeeded).toBe(1);
  });
});
