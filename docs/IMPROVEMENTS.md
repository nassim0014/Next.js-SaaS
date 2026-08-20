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

## 4. Webhook permanent-failure has no operator-visible signal

**File:** [`src/lib/webhooks/retry.ts`](../src/lib/webhooks/retry.ts)

`scheduleRetry` gives up after `MAX_ATTEMPTS` (6 tries over ~33 hours) and marks the event
`FAILED` — but the only signal that happens is `console.warn(...)`, whose comment literally says
"admin should investigate." Nothing surfaces that in the dashboard or notifies the org. An
org's webhook silently stops delivering and no one finds out short of reading server logs.

**Fix:** at minimum, surface permanently-failed `WebhookEvent`s in the existing
`dashboard/settings/webhooks` page (a count/badge is enough for a first pass); a follow-up could
email the org owner. Keep this PR to the surfacing step only — notification delivery is a
separate, larger piece.

## 5. `pnpm test:e2e` has nothing to run

**File:** `package.json` (`"test:e2e": "playwright test"`)

`context.md` and the README both list Playwright as the E2E strategy, but there is no
`playwright.config.ts` and no `*.spec.ts` anywhere in the repo — the script either errors ("no
config found") or silently no-ops depending on the Playwright version. Either claim is currently
false: there is no E2E coverage.

**Fix:** either (a) add a minimal Playwright config plus one smoke spec (sign up or log in →
land on `/dashboard`) so the advertised capability is real, or (b) if E2E is intentionally
deferred, remove the script and the "E2E: Playwright" line from `context.md`'s bonus-context
table so the docs stop overselling. (a) is more valuable given this is a boilerplate other
people build on and the promise is part of its pitch.

---

**Notes for future cycles:** nothing here needed the owner's judgement to identify, but item 2
(and the transaction wrapping in item 3) is a database-write-path change — per this loop's own
rules, escalate that piece to the higher-reasoning model rather than implementing it directly on
the cheap tier.
