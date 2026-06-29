# Security Posture

This doc describes the security design of the boilerplate. Use it as a starting point for your own threat model.

## Authentication

- **Supabase Auth** — JWT-based, cookies stored httpOnly + SameSite=Lax + Secure (in production)
- **Session refresh** — middleware refreshes the session on every request
- **OAuth** — supports GitHub, Google, and any Supabase-supported provider
- **No password storage** — Supabase handles password hashing (bcrypt)

## Authorization (RBAC)

- **Type-safe `can(role, action)` checks** — enforced via `lib/auth/rbac.ts`
- **4 roles** per org: OWNER, ADMIN, MEMBER, VIEWER (extendable via `RoleName` enum)
- **Permission map** — `DEFAULT_PERMISSIONS` in `lib/auth/permissions.ts`, mirrored in DB
- **Wildcard support** — `agents:*` matches `agents:create`, `agents:read`, etc.

## Multi-Tenancy

- **Shared DB with `organizationId`** on every tenant-scoped table
- **Row-Level Security** on every tenant-scoped table (defense-in-depth):
  - Even if the app layer has a bug and forgets to filter by org, the DB refuses cross-tenant reads
  - Policies defined in `supabase/migrations/0002_rls_policies.sql`
- **Service-role key** bypasses RLS — used only in server-side admin code (`lib/supabase/admin.ts`)
- **Per-org query budgets** — rate-limited at the Edge Function layer

## API Keys

- **Argon2 hashing** — never stored plaintext (uses `argon2` package)
- **Display prefix only** — `nks_live_abcd...` shown in UI, full key shown ONCE on creation
- **Revocable** — soft delete via `status: REVOKED`
- **Expiry** — optional `expiresAt` field
- **Last-used tracking** — `lastUsedAt` updated on each use

## Webhooks

### Inbound (Stripe, Lemon Squeezy, Supabase)

- **Signature verification** — every webhook verified before processing
- **Idempotency** — `providerEventId` unique constraint prevents double-processing
- **Constant-time comparison** — prevents timing attacks on signature checks

### Outbound (to customer endpoints)

- **HMAC-SHA256 signing** — every payload signed with `WEBHOOK_SIGNING_SECRET`
- **Exponential backoff with jitter** — 1m, 5m, 30m, 2h, 6h, 24h, then give up
- **Per-endpoint secrets** — each WebhookEndpoint has its own signing secret

## Audit Log

- **Every mutation** logged via `lib/audit/logger.ts`
- **Immutable** — no UPDATE or DELETE on `audit_logs` table
- **IP + User-Agent** captured automatically from request headers
- **Metadata** stored as JSON for flexible querying
- **90-day retention** on Pro, 1-year on Enterprise

## GDPR / Privacy

- **Right to access** — `/dashboard/settings/compliance` → "Download my data" → ZIP export
- **Right to erasure** — `/dashboard/settings/compliance` → "Delete my account":
  - Conversations + messages hard-deleted
  - API keys revoked + deleted
  - Memberships removed
  - User record anonymized (FK integrity preserved for billing/audit)
  - Supabase Auth user deleted (signs out everywhere)
  - Audit log entry written before user is anonymized
- **DataRequest table** tracks every export/deletion request with status + timestamps

## Secrets Management

- **`.env.local`** gitignored — never committed
- **Service role key** server-only — never imported in client code
- **Stripe / LLM keys** — server-only, never prefixed with `NEXT_PUBLIC_`
- **CRON_SECRET** protects cron endpoints from unauthorized invocation
- **`.env.example`** ships as a template — no real secrets

## Headers

- `X-Frame-Options: DENY` — no clickjacking
- `X-Content-Type-Options: nosniff` — no MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Threats not yet mitigated

Document known gaps here so buyers know what to harden:

- **CSRF** — relies on SameSite=Lax cookies; for non-idempotent actions, consider adding CSRF tokens
- **Rate limiting** — not yet implemented at the app layer; use Cloudflare/Vercel edge rate limits
- **DDoS** — relies on hosting provider's edge protection
- **SQL injection** — Prisma parameterizes all queries; raw queries in `lib/ai/rag.ts` use tagged templates (safe)

## Reporting vulnerabilities

Email: `your-email@example.com` (replace in your fork)

Please do not open public issues for security vulnerabilities.
