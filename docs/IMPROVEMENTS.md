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

---

**Notes for future cycles:** nothing here needed the owner's judgement to identify, but item 2
(and the transaction wrapping in item 3) is a database-write-path change — per this loop's own
rules, escalate that piece to the higher-reasoning model rather than implementing it directly on
the cheap tier.
