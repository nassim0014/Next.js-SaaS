import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

/**
 * FIXED-WINDOW RATE LIMITING — keyed by organization id.
 *
 * `checkBudget()` in lib/ai/cost.ts caps how much an org may spend in a
 * *month*. Nothing capped how fast it could spend it, so a single misbehaving
 * client could burn a month of LLM budget in minutes and rack up the provider
 * bill before the monthly cap ever tripped. This module is that missing cap.
 *
 * WHY ORG ID AND NOT USER ID: this app is multi-tenant B2B. The org is the
 * billing entity and the thing whose budget is at risk, so the org is the
 * correct blast radius. A per-user sub-limit is a separate, finer-grained
 * concern.
 *
 * WHY POSTGRES AND NOT A KV: there is no Redis/Upstash in this project, and
 * introducing one for a counter would add an operational dependency (and a
 * second source of truth) to a boilerplate that already has a database on the
 * request path. `rate_limit_windows` is one small row per org per window.
 *
 * ── The atomicity requirement ────────────────────────────────────────────────
 * A limiter written as "read the count, then write count + 1" is two
 * statements with a gap between them. N concurrent requests can all read the
 * same value and all decide they are under the limit — which is precisely the
 * burst this module exists to stop, so the naive version fails at its one job.
 *
 * `consumeRateLimit()` therefore does the read and the write in a **single**
 * `INSERT ... ON CONFLICT DO UPDATE` statement. Postgres takes a row lock on
 * the conflicting row, so concurrent callers serialize on it and each gets a
 * distinct `RETURNING request_count`. The `@@unique([organizationId, bucket,
 * windowStart])` index on the model is the conflict target that makes this
 * work; without it the statement is invalid, not merely slower.
 *
 * Prisma's own `upsert()` is deliberately not used: it does not guarantee
 * compilation to a single ON CONFLICT statement for a compound unique target,
 * and it cannot express `request_count = request_count + 1` as a read-free,
 * row-locked update. Raw SQL is also the established house style for
 * hot-path aggregation here (see the `$queryRawUnsafe` reporting queries in
 * lib/ai/cost.ts). The values are interpolated through a `$queryRaw` tagged
 * template, so they are bound parameters, not string-concatenated.
 *
 * ── Failure mode ─────────────────────────────────────────────────────────────
 * This fails CLOSED: a database error propagates and the request 500s rather
 * than sailing past the limiter. That costs nothing in practice — every caller
 * needs the same database a few lines later anyway — and failing open on a
 * limiter would hand an attacker a trivial bypass.
 */

/** Window length. Fixed at one minute; the bucket floor derives from it. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Requests per org per window on /api/chat.
 *
 * INCLUSIVE: the 20th request inside a window is allowed; the 21st is
 * rejected. Chosen as a sane default for interactive chat — a human converses
 * well under it, a runaway loop does not. A named constant rather than an env
 * var on purpose: this is one number to tune in one place, and an env var
 * would add a config surface (plus a parse/validate path) that nothing yet
 * asks for.
 */
export const CHAT_REQUESTS_PER_WINDOW = 20;

/** Bucket name for /api/chat rows in `rate_limit_windows`. */
export const CHAT_RATE_LIMIT_BUCKET = "chat";

/**
 * Floor `now` to the start of its fixed window.
 *
 * Windows are aligned to absolute epoch time, not to first-request time, so
 * every process computes the same boundary without coordinating. The tradeoff
 * of a fixed window is the boundary burst — up to 2x the limit across two
 * adjacent windows. That is an accepted, well-understood property of this
 * algorithm; a sliding window would remove it at the cost of keeping per
 * request timestamps.
 *
 * Pure function, exported for direct unit testing.
 */
export function currentWindowStart(
  now: Date = new Date(),
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export type ConsumeRateLimitInput = {
  organizationId: string;
  bucket: string;
  windowMs?: number;
  /** Injectable clock for tests. */
  now?: Date;
};

export type RateLimitState = {
  /** This request's position in the window: 1 for the first request. */
  count: number;
  windowStart: Date;
  /** Seconds until the current window rolls over. */
  retryAfterSeconds: number;
};

/**
 * Atomically record one request against the org's current window and return
 * the resulting count. Does NOT enforce anything — see `enforceRateLimit()`.
 */
export async function consumeRateLimit(input: ConsumeRateLimitInput): Promise<RateLimitState> {
  const windowMs = input.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const now = input.now ?? new Date();
  const windowStart = currentWindowStart(now, windowMs);

  // Single statement: insert-or-increment and read back the new value. The
  // ON CONFLICT target must match the model's @@unique exactly.
  const rows = await prisma.$queryRaw<Array<{ requestCount: number }>>`
    INSERT INTO rate_limit_windows
      (id, organization_id, bucket, window_start, request_count, created_at, updated_at)
    VALUES
      (gen_random_uuid(), ${input.organizationId}::uuid, ${input.bucket}, ${windowStart}::timestamptz, 1, now(), now())
    ON CONFLICT (organization_id, bucket, window_start)
    DO UPDATE SET
      request_count = rate_limit_windows.request_count + 1,
      updated_at = now()
    RETURNING request_count AS "requestCount"
  `;

  const count = rows[0]?.requestCount;
  if (typeof count !== "number") {
    // Unreachable in Postgres — INSERT ... ON CONFLICT DO UPDATE always
    // RETURNINGs its row. Surfaced loudly rather than defaulted to 0, because
    // defaulting would silently disable the limiter.
    throw new AppError("INTERNAL", "Rate limit counter returned no row; refusing to fail open");
  }

  const windowEndsAt = windowStart.getTime() + windowMs;
  return {
    count,
    windowStart,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1000)),
  };
}

export type EnforceRateLimitInput = ConsumeRateLimitInput & { limit: number };

/**
 * Consume one request and throw `AppError("RATE_LIMITED")` — HTTP 429 — when
 * the org has already used its whole window.
 *
 * The limit is INCLUSIVE: with `limit: 20`, the 20th request in the window
 * succeeds and the 21st throws.
 */
export async function enforceRateLimit(input: EnforceRateLimitInput): Promise<RateLimitState> {
  const windowMs = input.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const state = await consumeRateLimit(input);

  if (state.count > input.limit) {
    const windowSeconds = Math.round(windowMs / 1000);
    throw new AppError(
      "RATE_LIMITED",
      `Rate limit exceeded: ${input.limit} requests per ${windowSeconds}s for this organization. Retry in ${state.retryAfterSeconds}s.`,
      {
        limit: input.limit,
        windowSeconds,
        retryAfterSeconds: state.retryAfterSeconds,
      }
    );
  }

  return state;
}

/**
 * The /api/chat limit. Call once per request, as early as the org id is
 * known — the point is to reject before doing expensive work, and every
 * rejected request still costs one small write.
 */
export async function enforceChatRateLimit(
  organizationId: string,
  now?: Date
): Promise<RateLimitState> {
  return enforceRateLimit({
    organizationId,
    bucket: CHAT_RATE_LIMIT_BUCKET,
    limit: CHAT_REQUESTS_PER_WINDOW,
    now,
  });
}
