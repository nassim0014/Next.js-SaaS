import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AppError } from "@/lib/errors";

// The module talks to exactly one Prisma surface: the `$queryRaw` tagged
// template. Mocking ONLY that is itself part of the contract under test — a
// read-then-write implementation would reach for `prisma.rateLimitWindow
// .findUnique` / `.update` / `.upsert`, none of which exist here, so it would
// blow up rather than quietly pass.
const queryRawMock: Mock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...(args as [])),
  },
}));

const {
  consumeRateLimit,
  currentWindowStart,
  enforceRateLimit,
  enforceChatRateLimit,
  CHAT_REQUESTS_PER_WINDOW,
  CHAT_RATE_LIMIT_BUCKET,
  RATE_LIMIT_WINDOW_MS,
} = await import("@/lib/rate-limit");

/** Reconstruct the SQL text + bound parameters of the last `$queryRaw` call. */
function lastQuery(): { sql: string; values: unknown[] } {
  const call = queryRawMock.mock.calls.at(-1) as [TemplateStringsArray, ...unknown[]] | undefined;
  if (!call) throw new Error("no $queryRaw call was made");
  const [strings, ...values] = call;
  // Join on a placeholder so interpolation points stay visible in assertions.
  return { sql: strings.join(" $? ").replace(/\s+/g, " ").trim(), values };
}

/** Make the next atomic increment report `count` as the post-increment value. */
function respondWithCount(count: number): void {
  queryRawMock.mockResolvedValueOnce([{ requestCount: count }]);
}

const ORG = "11111111-1111-1111-1111-111111111111";

// 12:00:10 — ten seconds into the 12:00 window.
const TEN_PAST = new Date("2026-09-04T12:00:10.000Z");
// 12:01:00 — the very first instant of the *next* window.
const NEXT_WINDOW = new Date("2026-09-04T12:01:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rate-limit / currentWindowStart", () => {
  it("floors a timestamp to the start of its fixed window", () => {
    expect(currentWindowStart(TEN_PAST).toISOString()).toBe("2026-09-04T12:00:00.000Z");
  });

  it("gives every instant inside one window the same boundary", () => {
    const early = currentWindowStart(new Date("2026-09-04T12:00:00.000Z"));
    const late = currentWindowStart(new Date("2026-09-04T12:00:59.999Z"));
    expect(early.getTime()).toBe(late.getTime());
  });

  it("rolls over to a new boundary at the next window", () => {
    expect(currentWindowStart(TEN_PAST).getTime()).not.toBe(
      currentWindowStart(NEXT_WINDOW).getTime()
    );
    expect(currentWindowStart(NEXT_WINDOW).toISOString()).toBe("2026-09-04T12:01:00.000Z");
  });

  it("honours a custom window length", () => {
    // 10s windows: 12:00:10 is its own boundary, 12:00:19 floors back to it.
    expect(currentWindowStart(TEN_PAST, 10_000).toISOString()).toBe("2026-09-04T12:00:10.000Z");
    expect(currentWindowStart(new Date("2026-09-04T12:00:19.000Z"), 10_000).toISOString()).toBe(
      "2026-09-04T12:00:10.000Z"
    );
  });

  it("defaults to a one-minute window", () => {
    expect(RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// These are the regression guards for the race the whole module exists to
// avoid. A "SELECT count, then UPDATE count + 1" limiter lets N concurrent
// requests all read the same value and all conclude they are under the limit.
// Each assertion below fails against that shape.
// ─────────────────────────────────────────────────────────────────────────────
describe("rate-limit / consumeRateLimit is atomic", () => {
  it("issues exactly ONE database statement per request", async () => {
    respondWithCount(1);
    await consumeRateLimit({ organizationId: ORG, bucket: "chat", now: TEN_PAST });

    // Read-then-write needs at least two round trips; this must stay at one.
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("increments in place via INSERT ... ON CONFLICT DO UPDATE and returns the new count", async () => {
    respondWithCount(3);
    const state = await consumeRateLimit({
      organizationId: ORG,
      bucket: "chat",
      now: TEN_PAST,
    });

    const { sql } = lastQuery();
    expect(sql).toContain("INSERT INTO rate_limit_windows");
    expect(sql).toContain("ON CONFLICT (organization_id, bucket, window_start)");
    expect(sql).toContain("DO UPDATE SET");
    // The increment must be computed by the database from the stored value,
    // not from a number this process read earlier.
    expect(sql).toContain("request_count = rate_limit_windows.request_count + 1");
    expect(sql).toContain('RETURNING request_count AS "requestCount"');
    // No separate read anywhere in the statement.
    expect(sql).not.toMatch(/\bSELECT\b/i);

    expect(state.count).toBe(3);
  });

  it("binds the org id, bucket and floored window start as parameters", async () => {
    respondWithCount(1);
    await consumeRateLimit({ organizationId: ORG, bucket: "chat", now: TEN_PAST });

    const { values } = lastQuery();
    expect(values[0]).toBe(ORG);
    expect(values[1]).toBe("chat");
    expect((values[2] as Date).toISOString()).toBe("2026-09-04T12:00:00.000Z");
  });

  it("reports how long until the window rolls over", async () => {
    respondWithCount(1);
    const state = await consumeRateLimit({
      organizationId: ORG,
      bucket: "chat",
      now: TEN_PAST, // 50s left in the 12:00 window
    });
    expect(state.retryAfterSeconds).toBe(50);
  });

  it("throws INTERNAL rather than failing open when the increment returns no row", async () => {
    queryRawMock.mockResolvedValueOnce([]);
    await expect(
      consumeRateLimit({ organizationId: ORG, bucket: "chat", now: TEN_PAST })
    ).rejects.toMatchObject({ type: "INTERNAL" });
  });

  it("propagates database errors instead of swallowing them (fails closed)", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection terminated"));
    await expect(
      consumeRateLimit({ organizationId: ORG, bucket: "chat", now: TEN_PAST })
    ).rejects.toThrow("connection terminated");
  });
});

describe("rate-limit / enforceRateLimit boundary (limit is INCLUSIVE)", () => {
  const under = { organizationId: ORG, bucket: "chat", limit: 20, now: TEN_PAST };

  it("passes a request comfortably under the limit", async () => {
    respondWithCount(1);
    await expect(enforceRateLimit(under)).resolves.toMatchObject({ count: 1 });
  });

  it("passes the request that lands exactly ON the limit", async () => {
    respondWithCount(20);
    await expect(enforceRateLimit(under)).resolves.toMatchObject({ count: 20 });
  });

  it("rejects the first request OVER the limit with RATE_LIMITED / 429", async () => {
    respondWithCount(21);
    await expect(enforceRateLimit(under)).rejects.toBeInstanceOf(AppError);

    respondWithCount(21);
    const err = await enforceRateLimit(under).catch((e: unknown) => e as AppError);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).type).toBe("RATE_LIMITED");
    expect((err as AppError).statusCode).toBe(429);
  });

  it("carries the limit and retry-after in the error details", async () => {
    respondWithCount(99);
    const err = (await enforceRateLimit(under).catch((e: unknown) => e)) as AppError;
    expect(err.details).toEqual({
      limit: 20,
      windowSeconds: 60,
      retryAfterSeconds: 50,
    });
  });

  it("still records the over-limit request (the counter is consumed before the check)", async () => {
    respondWithCount(21);
    await enforceRateLimit(under).catch(() => null);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});

describe("rate-limit / window reset", () => {
  it("writes a different window_start once the window rolls over", async () => {
    respondWithCount(20);
    await enforceRateLimit({
      organizationId: ORG,
      bucket: "chat",
      limit: 20,
      now: TEN_PAST,
    });
    const first = lastQuery().values[2] as Date;

    respondWithCount(1);
    await enforceRateLimit({
      organizationId: ORG,
      bucket: "chat",
      limit: 20,
      now: NEXT_WINDOW,
    });
    const second = lastQuery().values[2] as Date;

    expect(second.getTime()).toBe(first.getTime() + RATE_LIMIT_WINDOW_MS);
  });

  it("lets an org through again in the new window after being blocked in the old one", async () => {
    // Blocked at the tail of the 12:00 window...
    respondWithCount(21);
    await expect(
      enforceRateLimit({
        organizationId: ORG,
        bucket: "chat",
        limit: 20,
        now: new Date("2026-09-04T12:00:59.000Z"),
      })
    ).rejects.toMatchObject({ type: "RATE_LIMITED" });

    // ...and allowed one second later, because the new window's row starts
    // its own count at 1 rather than inheriting the old total.
    respondWithCount(1);
    await expect(
      enforceRateLimit({
        organizationId: ORG,
        bucket: "chat",
        limit: 20,
        now: NEXT_WINDOW,
      })
    ).resolves.toMatchObject({ count: 1 });
  });
});

describe("rate-limit / enforceChatRateLimit", () => {
  it("applies the chat bucket and the chat limit", async () => {
    respondWithCount(1);
    await enforceChatRateLimit(ORG, TEN_PAST);
    expect(lastQuery().values[1]).toBe(CHAT_RATE_LIMIT_BUCKET);
    expect(CHAT_RATE_LIMIT_BUCKET).toBe("chat");
  });

  it("rejects one request past CHAT_REQUESTS_PER_WINDOW", async () => {
    respondWithCount(CHAT_REQUESTS_PER_WINDOW);
    await expect(enforceChatRateLimit(ORG, TEN_PAST)).resolves.toBeTruthy();

    respondWithCount(CHAT_REQUESTS_PER_WINDOW + 1);
    await expect(enforceChatRateLimit(ORG, TEN_PAST)).rejects.toMatchObject({
      type: "RATE_LIMITED",
    });
  });
});
