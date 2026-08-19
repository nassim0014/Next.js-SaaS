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

## 2. GDPR erasure (`deleteUserData`) is eight sequential writes with no transaction

**File:** [`src/lib/gdpr/deletion.ts`](../src/lib/gdpr/deletion.ts)

Steps 1–7 (delete conversations, anonymize `TokenUsage`, delete API keys, delete memberships,
create the `DataRequest` audit record, write the audit log, anonymize the `User` row) are each
awaited independently with no `prisma.$transaction(...)` wrapper. If step 4 or 5 throws — a
constraint violation, a DB blip — the user's conversation history and API keys are already
gone, but there is no `DataRequest` record and no audit log entry showing an erasure happened,
and the `User` row is never anonymized. That is exactly the half-erased, unreconcilable state a
GDPR erasure implementation must not be able to reach.

**Fix:** wrap steps 1–7 (the pure-Postgres steps) in one `prisma.$transaction`. Step 8
(`supabaseAdmin().auth.admin.deleteUser`) is an external call and can't join that transaction —
keep it last, and if it fails, log loudly rather than silently swallowing (currently it does
`throw error`, which is correct, but nothing catches it upstream to alert an operator that a
user is DB-erased but still has a live Supabase Auth session).

This touches a database write path — flagged per the loop's own escalation rule, whoever picks
this up should hand it to the higher-reasoning model rather than free-handing it.

## 3. GDPR and audit-log code have zero test coverage

**Files:** [`src/lib/gdpr/deletion.ts`](../src/lib/gdpr/deletion.ts),
[`src/lib/gdpr/export.ts`](../src/lib/gdpr/export.ts),
[`src/lib/audit/logger.ts`](../src/lib/audit/logger.ts)

Only 4 of ~30 files under `src/lib/` have a `.test.ts` next to them
(`ai/cost`, `billing/webhooks`, `webhooks/signer`, `auth/permissions`) — and none of them are
the two areas this boilerplate advertises as compliance-grade: GDPR erasure/export and the
"immutable audit trail on every mutation" (per `context.md`, USP 1). A regression here is the
kind that looks fine until an actual data-subject request or audit surfaces it.

**Fix:** add unit tests for `deleteUserData`/`exportUserData` (mock Prisma + Supabase admin,
assert every table listed in the file's own "what gets DELETED / ANONYMIZED / HARD-DELETED"
comment is actually touched) and for `audit()` (assert it never throws in a way that could abort
the calling mutation, and that required fields are always present). Natural to pair with item 2
if the same PR adds the transaction.

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
