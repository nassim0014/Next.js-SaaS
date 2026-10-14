import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const findUniqueMock: Mock = vi.fn();
const updateMock: Mock = vi.fn().mockResolvedValue({});
const findManyMock: Mock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEvent: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
    },
  },
}));

const { scheduleRetry, getEventsForRetry } = await import("@/lib/webhooks/retry");

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
});

describe("webhooks/retry - scheduleRetry", () => {
  it("does nothing when the event no longer exists", async () => {
    findUniqueMock.mockResolvedValue(null);
    await scheduleRetry("missing-event");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([
    [1, 60 * 1000], // 1 min
    [2, 5 * 60 * 1000], // 5 min
    [3, 30 * 60 * 1000], // 30 min
    [4, 2 * 60 * 60 * 1000], // 2 hours
    [5, 6 * 60 * 60 * 1000], // 6 hours
  ])("schedules a jittered retry ~%i-interval out on attempt %i", async (attempts, expectedMs) => {
    findUniqueMock.mockResolvedValue({ attempts });
    const before = Date.now();

    await scheduleRetry("evt-1");

    expect(updateMock).toHaveBeenCalledTimes(1);
    const call = updateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: { nextRetryAt: Date };
    };
    expect(call.where).toEqual({ id: "evt-1" });
    const deltaMs = call.data.nextRetryAt.getTime() - before;
    // ±20% jitter around the documented interval for this attempt count.
    expect(deltaMs).toBeGreaterThanOrEqual(expectedMs * 0.8 - 50);
    expect(deltaMs).toBeLessThanOrEqual(expectedMs * 1.2 + 50);
  });

  it("gives up only after exhausting all 6 documented retry intervals, not one early", async () => {
    // Regression guard: attempts === 6 is the 6th failure, which per the
    // documented "1m, 5m, 30m, 2h, 6h, 24h, give up" schedule must still get
    // the 24h retry scheduled. The pre-fix `attempts >= MAX_ATTEMPTS` check
    // gave up here instead, one retry early. This case fails against that
    // old `>=` check and passes with the fixed `>`.
    findUniqueMock.mockResolvedValue({ attempts: 6 });
    const before = Date.now();

    await scheduleRetry("evt-6th-failure");

    expect(updateMock).toHaveBeenCalledTimes(1);
    const call = updateMock.mock.calls[0]![0] as {
      data: { status?: string; nextRetryAt: Date | null };
    };
    expect(call.data.status).not.toBe("FAILED");
    expect(call.data.nextRetryAt).not.toBeNull();
    const deltaMs = (call.data.nextRetryAt as Date).getTime() - before;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(deltaMs).toBeGreaterThanOrEqual(twentyFourHoursMs * 0.8 - 50);
    expect(deltaMs).toBeLessThanOrEqual(twentyFourHoursMs * 1.2 + 50);
  });

  it("gives up permanently once the 6th retry itself has failed (attempts=7)", async () => {
    findUniqueMock.mockResolvedValue({ attempts: 7 });

    await scheduleRetry("evt-7th-failure");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "evt-7th-failure" },
      data: { status: "FAILED", nextRetryAt: null },
    });
  });
});

describe("webhooks/retry - getEventsForRetry", () => {
  it("queries FAILED events due now, batched and oldest-due first", async () => {
    findManyMock.mockResolvedValue([]);

    await getEventsForRetry();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FAILED" }),
        take: 50,
        orderBy: { nextRetryAt: "asc" },
      })
    );
  });

  it("maps each row to the shape the cron route expects, dropping extra fields", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "evt-1",
        endpointId: "ep-1",
        eventType: "conversation.created",
        payload: { foo: "bar" },
        status: "FAILED",
        attempts: 2,
        nextRetryAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    const result = await getEventsForRetry();

    expect(result).toEqual([
      {
        id: "evt-1",
        endpointId: "ep-1",
        eventType: "conversation.created",
        payload: { foo: "bar" },
      },
    ]);
  });
});
