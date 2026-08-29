# Improvements Backlog

Created by the closed-improvement-loop's first visit to this repo (2026-08-19). Ranked by
impact; each item is scoped to be one reviewable PR. Pick the top unblocked item on future
cycles rather than the easiest one.

## 1. `/api/org/switch` sets the active-org cookie without verifying membership

**File:** [`src/app/api/org/switch/route.ts`](../src/app/api/org/switch/route.ts)

Both `GET` and `POST` call `setActiveOrgId(orgId)` straight from the query string / request
body — there is no `getOrgMembership(user.id, orgId)` check before the cookie is set. Any
authenticated user can point their `active-org-id` cookie at an organization they do not
belong to.

This is not (as far as this pass could confirm) an active data leak: the two consumers this
pass read — [`webhooks/actions.ts`](../src/app/dashboard/settings/webhooks/actions.ts) and the
GDPR compliance actions — both re-check membership or scope every query by `session.user.id`
*and* `organizationId` together, so a forged org id currently resolves to "no matching rows"
rather than someone else's data. But that safety is incidental, not designed: it depends on
every future Server Action remembering to re-verify membership itself, and `rbac.ts`/
`org-context.ts` provide no helper that forces that. One new action written the way
`requireActiveOrgId()`'s own doc comment implies ("just call this, you're scoped") is a
cross-tenant IDOR.

**Fix:** add a `getOrgMembership` check inside `/api/org/switch` and return 403 if the caller
isn't a member. Cheap, closes the hole at the source instead of relying on every call site.

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
