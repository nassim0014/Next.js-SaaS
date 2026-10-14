# Improvements backlog

Internal engineering backlog. Each item: what's wrong, why it matters, how to
check the fix. Checked-off items stay here with a `(done YYYY-MM-DD)` note so
the history of what was found and fixed isn't lost.

Recreated 2026-10-14 — the previous version of this file was dropped in commit
`7295d82` ("Docs and formatting cleanup", 2026-10-02) as a "stale internal
doc". Items below were found fresh by reading the current code, not carried
over from that version.

## Open

1. [x] `src/lib/webhooks/retry.ts`'s `scheduleRetry()` gave up one retry
       early. The docstring promises the backoff schedule "1m, 5m, 30m, 2h, 6h,
       24h, give up", but the permanent-failure check was `attempts >=
MAX_ATTEMPTS` (`MAX_ATTEMPTS = RETRY_INTERVALS_MS.length = 6`). Since
       `attempts` is already incremented before `scheduleRetry` is called, the
       6th failure (`attempts === 6`) hit that check and was marked permanently
       failed immediately — the 24h retry in the docstring's own schedule never
       ran. Matters because a webhook endpoint that has a single bad hour (e.g.
       the receiver is mid-deploy) gets permanently abandoned after roughly 8.5
       hours of real backoff instead of the documented roughly 39 hours, with no
       further retry and no alert beyond a `console.warn`. Checked by:
       `attempts=6` should schedule the 24h retry (not mark permanently failed);
       only `attempts=7` (the 6th retry itself having failed) should give up.
       **Fixed 2026-10-14**: changed the check to `attempts > MAX_ATTEMPTS`;
       regression test in `src/lib/webhooks/retry.test.ts` ("gives up only after
       exhausting all 6 documented retry intervals, not one early") fails
       against the pre-fix `>=` and passes with `>`. Both `dispatcher.ts` and
       `retry.ts` also had zero test coverage before this change —
       `src/lib/webhooks/dispatcher.test.ts` and `src/lib/webhooks/retry.test.ts`
       now cover both (done 2026-10-14).

2. [ ] `src/lib/errors.ts`'s `toAppError()` maps caught errors to HTTP status
       codes by matching exact `Error.message` strings (`"UNAUTHORIZED"`,
       `"FORBIDDEN"` prefix, `"NO_ACTIVE_ORG"`, `"BUDGET_EXCEEDED"`,
       `"NO_SUBSCRIPTION"`) thrown elsewhere in the app. This has no test
       coverage, so a call site that renames or rewords one of those thrown
       messages silently falls through to a generic `500 INTERNAL` instead of
       the correct `401`/`402`/`400` status — a regression nothing would catch
       until a user reports the wrong status code. Check by adding
       `src/lib/errors.test.ts` asserting each known message maps to its
       `AppError` type/status, plus an unknown message falling through to
       `INTERNAL`.

3. [ ] `src/lib/ai/embeddings.ts`'s `padTo1536()` (pads or truncates a model's
       embedding vector to the database's fixed `vector(1536)` column) has no
       test, despite being the one place a dimension mismatch between the
       embedding provider and the schema gets silently "fixed" by zero-padding
       or truncation rather than erroring. A future switch to a provider that
       returns more than 1536 dimensions would silently drop the tail instead of
       failing loudly. Check by adding `src/lib/ai/embeddings.test.ts` covering
       under-length, over-length, and exact-1536-length inputs.

4. [ ] `src/lib/gdpr/export.ts` (the GDPR data-export path — compliance
       surface, not just app logic) has zero test coverage. Check by reading the
       file for its actual shape and logic, then covering whatever it assembles
       (likely per-table row collection) with a test that fails if a data
       category is silently dropped.
