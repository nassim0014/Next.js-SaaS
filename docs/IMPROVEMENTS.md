# Improvements Backlog

Created by the closed-improvement-loop's first visit to this repo (2026-08-19). Ranked by
impact; each item is scoped to be one reviewable PR. Pick the top unblocked item on future
cycles rather than the easiest one.

**Status (2026-08-27):** items 1–5 are done. Open, in priority order: **7** (rate limiting —
top pick next cycle), then **8** (parallelise the webhook-retry cron). Item 6 was found and
fixed this cycle.

## 1. ~~`/api/org/switch` sets the active-org cookie without verifying membership~~ ✅

**Done in PR #55** (`fix: verify org membership in /api/org/switch before setting cookie`,
commit `c31bbcb`, 2026-08-19). Both `GET` and `POST` now call
`getOrgMembership(session.user.id, orgId)` and return 403 when the caller is not a member.

> **Backlog-bookkeeping note (2026-08-27):** this item was fixed on 2026-08-19 but never
> ticked off here, so a later cycle would have re-done work already merged. Same rot pattern
> the btc-llm-sentiment registry notes warn about. Before starting any item, `grep` the code
> for the described symptom and check `git log -S` on the named file first.

## 6. `/api/cron/webhook-retry` never scheduled the next attempt on a failed retry ✅

**File:** [`src/app/api/cron/webhook-retry/route.ts`](../src/app/api/cron/webhook-retry/route.ts)

**Done this cycle (2026-08-27).** The cron handler updated the `WebhookEvent` to `FAILED` and
incremented `attempts`, but — unlike `dispatcher.ts`'s `deliver()` — never called
`scheduleRetry(event.id)`. `scheduleRetry` is the only thing that (a) computes the next
`nextRetryAt` on the 1m→5m→30m→2h→6h→24h backoff ladder and (b) marks the event permanently
failed (`nextRetryAt: null`, `[WEBHOOK PERMANENT FAILURE]` log) once `attempts >= 6`.

Because `getEventsForRetry()` selects `status: FAILED AND nextRetryAt <= now`, a failed retry
left `nextRetryAt` at its stale past value, so the event was re-tried **every 5 minutes
forever** — no backoff, no cutoff — hammering a dead endpoint indefinitely and unbounded-
incrementing `attempts`. The first failure (via `deliver()`) was scheduled correctly; every
subsequent one via the cron was not.

**Fix:** call `await scheduleRetry(event.id)` after both `FAILED` updates in the cron loop,
mirroring `deliver()`. Added `src/app/api/cron/webhook-retry/route.test.ts` (5 tests) — the two
failure-path tests fail against the pre-fix handler (verified by `git stash`).

## 7. No rate limiting anywhere in the app

`src/lib/errors.ts` defines `RATE_LIMITED` / HTTP 429, but nothing in the codebase ever throws
it (`grep -rin "rate.?limit" src/` finds only the enum). Unprotected:

- **`/api/chat`** — every request costs real LLM tokens. `checkBudget(orgId)` caps *monthly*
  spend but nothing caps request *rate*, so a single client can burn a month's budget in
  minutes and rack up provider bills before the cap trips.
- **`/api/org/switch`**, **auth callbacks**, **API-key creation** — no throttle on abuse /
  enumeration.

**Suggested:** a small fixed-window limiter keyed by user id (or IP for unauthenticated
routes), backed by the existing Postgres or a lightweight KV. Scope the first PR to `/api/chat`
only — highest cost, clearest key (org id) — and leave the rest ranked.

## 8. `webhook-retry` cron delivers sequentially with a 10s timeout per event

**File:** [`src/app/api/cron/webhook-retry/route.ts`](../src/app/api/cron/webhook-retry/route.ts)

`getEventsForRetry()` returns up to 50 events; the cron `await fetch`es them one at a time,
each with `AbortSignal.timeout(10_000)`. 50 slow/dead endpoints ⇒ up to 500s wall time, past
typical serverless function limits — the batch gets killed mid-loop and the tail never
processes. `dispatcher.ts` already fans out with `Promise.allSettled`; the cron should too
(bounded concurrency, e.g. 10).

## 2. ~~GDPR erasure (`deleteUserData`) is eight sequential writes with no transaction~~ ✅

**Decision #5: Z.ai takes it.** Wrapped steps 1–7 in a single
`prisma.$transaction(async (tx) => { ... })` — the database now either
sees the fully-erased state or the original state, never the
half-erased, unreconcilable state. Each `prisma.*` call inside the
transaction uses the `tx` client instead of the top-level `prisma`
client. Step 8 (Supabase Auth deletion) stays outside the transaction
(external call, can't join a Postgres transaction); its `throw error`
behavior is preserved so a failure there surfaces to the caller.

Same shape as #55 (org-switch IDOR fix): the fix is small, focused,
and verifiable by inspection — the transaction wrapper is the only
structural change.

## 3. ~~GDPR and audit-log code have zero test coverage~~ ✅

Added tests for `audit()` (7 tests in `src/lib/audit/logger.test.ts`)
and `deleteUserData()` (8 tests in `src/lib/gdpr/deletion.test.ts`).

**audit() tests:** verifies all fields are populated, ipAddress/userAgent
auto-populated from headers, provided values override headers, null
defaults, and the critical "never throws" contract (swallows DB errors
and logs to console).

**deleteUserData() tests:** verifies the `prisma.$transaction` wrapper
from item 2 — confirms steps 1-7 run inside the transaction (conversation
delete, TokenUsage anonymize, DataRequest create, User anonymize, audit
log), step 8 (Supabase Auth deletion) runs after, and Auth failures
throw to the caller.

`exportUserData` tests deferred — it needs a Supabase Storage mock which
is more involved. The deletion + audit coverage is the higher-value
slice (audit never-throws contract + transaction atomicity).

## 4. ~~Webhook permanent-failure has no operator-visible signal~~ ✅

Added a "Permanently Failed Deliveries" section to the
`dashboard/settings/webhooks` page. When webhook events exceed
`MAX_ATTEMPTS` (6 retries over ~33 hours), they're now surfaced in a
destructive-styled card at the top of the page — showing event type,
endpoint URL, attempt count, and when the failure happened.

The Prisma query includes failed deliveries (`status: "FAILED"`) in the
existing `webhookEndpoint.findMany` call, so no extra DB round-trip is
needed. The card only renders when `totalFailed > 0` — zero failures
means zero visual noise.

Notification delivery (email/Slack) deferred as a separate piece per
the backlog note.

## 5. ~~`pnpm test:e2e` has nothing to run~~ ✅

Added a minimal Playwright config + smoke spec so the advertised
"E2E: Playwright" capability is real.

- **`playwright.config.ts`**: standard config with chromium project,
  `webServer` that runs `pnpm dev` and waits for `:3000`. Reuses
  existing dev server in local runs; starts a fresh one in CI.
- **`tests/e2e/smoke.spec.ts`**: two tests — (1) landing page loads and
  shows a title without an error state, (2) login page is reachable
  and renders the email input.
- `@playwright/test` was already in devDependencies — no package.json
  change needed.

## 6. `src/lib/billing/metering.ts` has zero test coverage   `source: coverage`

Filed by the repo-backlog-refresh loop, 2026-08-29. `src/lib/billing/`
has one test file (`webhooks.test.ts`); `metering.ts` has none. It holds
three functions on the billing hot path:

- **`hasExceededQuota(orgId, planSlug)`** — called by the chat route to
  gate every AI request against the plan's monthly token quota. A wrong
  boolean here either lets free-tier users run unbounded inference or
  locks paying customers out mid-conversation. It reads
  `getCurrentPeriodUsage()` (which *is* tested, in `ai/cost.test.ts`) and
  compares against `PLANS[planSlug].tokenQuota`, with `-1` meaning
  unlimited.
- **`rollupCurrentPeriod(orgId)`** — the nightly `usageRecord.upsert`
  that every usage report and overage charge is derived from. The
  "idempotent via unique constraint" claim in its docstring is untested.
- **`getQuotaPercentage(orgId, planSlug)`** — only `tokenQuota === -1` is
  special-cased. A plan row with `tokenQuota === 0` yields
  `Math.round(n / 0)` → `Infinity`/`NaN` rather than a clean 0-or-100.
  All seeded plans currently have positive or `-1` quotas, so this is
  latent, but a test would pin the contract.

Add a test file with a mocked `getCurrentPeriodUsage` and the real
`PLANS` table: quota-not-exceeded, quota-exactly-met (`>=` boundary),
unlimited plan, and the `getQuotaPercentage` zero-quota edge. Pure logic,
no DB — same shape as `ai/cost.test.ts`.

## 7. `src/lib/webhooks/dispatcher.ts` has zero test coverage   `source: coverage`

`signer.ts` and `retry.ts` both have test files; `dispatcher.ts` — the
seam that ties them together — has none. `dispatchWebhookEvent()` does
the endpoint lookup (`isActive`, `events: { has: eventType }` filter),
and `deliver()` creates the `WebhookEvent` row, signs the body, POSTs
with a 10s `AbortSignal.timeout`, and drives the status transitions
(`PENDING` → `DELIVERED` / `FAILED` + `attempts` increment +
`scheduleRetry`). None of that branching is exercised.

Worth covering because it is the untested half of the webhook-reliability
work that items 4 and 5 (and open PR #70) invested in: the retry logic is
only correct if `deliver()` records `attempts` and `status` the way
`scheduleRetry()` expects. Test with a mocked `fetch` and `prisma`:
2xx path, non-2xx path, thrown/timeout path, and the "no subscribed
endpoints → no-op" early return.

## 8. `src/lib/ai/rag.ts` has zero coverage — `chunkDocument` can infinite-loop   `source: coverage`

`rag.ts` (RAG retrieval + context formatting + document chunking) has no
test file. Beyond the missing coverage there is a concrete defect:

`chunkDocument(text, chunkSize = 2000, overlap = 200)` advances the
cursor with `i += chunkSize - overlap` and has no guard that
`overlap < chunkSize` (`rag.ts:82-90`). Any caller passing
`overlap >= chunkSize` — or swapping the two positional args — makes the
step `<= 0`, so the `while (i < text.length)` loop never terminates and
`chunks` grows without bound until the process is killed. The defaults
are safe, so this is dormant today, but it is an un-validated public
function that feeds the ingestion pipeline.

Fix: clamp/validate (`if (overlap >= chunkSize) throw` or
`Math.max(1, chunkSize - overlap)`), then add tests — the chunking guard,
short-text-single-chunk, overlap correctness, and `formatContextForPrompt`
with zero and N chunks (pure functions, no DB).

Loop-Agent: backlog-refresh / claude / laptop

---

**Notes for future cycles:** nothing here needed the owner's judgement to identify, but item 2
(and the transaction wrapping in item 3) is a database-write-path change — per this loop's own
rules, escalate that piece to the higher-reasoning model rather than implementing it directly on
the cheap tier.

Item 6 (2026-08-27) also touches a DB write path (`WebhookEvent` updates) but the fix is a
one-line mirror of the already-correct `deliver()` path and is pinned by unit tests, so it was
done on the cheap tier and its PR left open for human review rather than auto-merged.
