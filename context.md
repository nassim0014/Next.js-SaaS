# Project Context — AI SaaS Boilerplate

> **Single source of truth.** Any AI agent (Cursor, Cline, Claude Desktop) or human
> collaborator should be able to read this file and understand the project in 60 seconds.
>
> **Update rule:** Every Phase completion appends a new section. Do not edit past
> decisions retroactively — add an "Amendment" note instead.

---

## 0. TL;DR

| Field | Value |
|---|---|
| **Project name** | `Next.js-SaaS` |
| **Niche** | AI-powered SaaS — RAG chatbot / agent platform wrapper |
| **Primary audience** | Enterprise leads + recruiters evaluating production-grade patterns |
| **Monetization** | Gumroad / Lemon Squeezy, $49–$299 tier |
| **Stack** | Next.js 16+ · Supabase (Auth, DB, RLS, Storage, Realtime, Edge, pgvector) · Prisma · Vercel AI SDK · shadcn/ui + Tailwind v3.4 · Stripe + Lemon Squeezy · Vitest |
| **Current phase** | Phase 3 & 4 — Implementation, Tooling & Productization (SHIPPED, ongoing hardening) |
| **Next phase** | Ongoing maintenance — see `docs/CHANGELOG.md` and open PRs for in-flight work |
| **GitHub owner** | `nassim0014` |
| **Repo** | [`nassim0014/Next.js-SaaS`](https://github.com/nassim0014/Next.js-SaaS) |
| **MCP editor (user)** | Linux, free plan — VS Code + Cline recommended (see `docs/MCP-SETUP.md`) |

---

## 1. Discovery Decisions (Phase 1 — COMPLETE)

Locked-in answers from the discovery questionnaire:

1. **Niche:** AI-powered SaaS (RAG chatbot / agent platform wrapper)
2. **Audience:** Enterprise leads who need to see production-grade patterns (RBAC, audit logs, multi-tenancy)
3. **Supabase features:** ALL — Auth, DB, RLS, Storage, Realtime, Edge Functions, pgvector
4. **Prisma schema:** Designed by the architect — 24 models across 7 domains
5. **USPs (the "Hook"):**
   - **USP 1:** RBAC + audit logging + GDPR data-export out of the box
   - **USP 2:** MCP-native — `.mcp.json` wired for Cursor/Claude Desktop so buyers AI-develop on top instantly
   - **USP 3:** Stripe + Lemon Squeezy billing engine with webhook reconciliation (not just a checkout button)
   - **USP 4:** Type-safe end-to-end (Zod → Prisma → server actions → React, zero `any`)
   - **USP 5 (creative, ⭐):** **AI Cost Observability** — every LLM call metered to the cent, per-org budget caps, usage-based overage billing, live `/usage` dashboard

**Bonus context:**
- Billing: Stripe (primary) + Lemon Squeezy (alt, MoR for EU)
- UI: shadcn/ui (default) + Tailwind
- TypeScript: strict mode + zero-`any` ESLint rule
- E2E: Playwright

---

## 2. Schema Overview (Phase 2 — COMPLETE)

**File:** `prisma/schema.prisma` (24 models)

### Domain Map

| Domain | Models | Purpose |
|---|---|---|
| Identity & Tenancy | `User`, `Organization`, `Membership`, `Invitation` | Multi-tenant shared-DB, `organizationId` everywhere |
| RBAC | `Permission`, `RolePermission`, `RoleName` enum | `can(user, action, resource)` checks |
| AI Core | `Agent`, `ModelConfig`, `Conversation`, `Message` | Streaming chat, model-agnostic config |
| RAG | `KnowledgeBase`, `Document`, `Embedding` (pgvector 1536-dim) | Upload → chunk → embed → retrieve |
| ⭐ Cost Observability | `TokenUsage` | Per-call metering — the 5th USP |
| Billing | `Plan`, `Subscription`, `BillingEvent`, `UsageRecord` | Stripe + LMS, idempotent webhooks, metered usage |
| Compliance | `AuditLog`, `DataRequest` | SOC2-ready audit + GDPR export/erase |
| Integrations | `ApiKey`, `WebhookEndpoint`, `WebhookEvent` | HMAC-signed outbound webhooks + retry queue |
| Storage | `FileAsset` | Supabase Storage metadata + checksums |

### Schema Conventions (enforced everywhere)

- **UUIDs** as primary keys (`@db.Uuid`) — Supabase Auth-compatible, no enumeration attacks
- **Money in cents** as `Int` — never floats
- **Snake_case columns** via `@map` for SQL ergonomics
- **Composite index** on `[organizationId, <filterable column>]` for every tenant-scoped table
- **Cascade deletes** scoped to `Organization` — never cross-tenant
- **Soft references** for high-volume tables (`TokenUsage`, `AuditLog`) to avoid FK lock contention

### Multi-Tenancy Model

**Shared DB with `organizationId` on every tenant-scoped table.**

- One DB, one migration path, one backup
- RLS policies on Supabase enforce isolation at the DB layer (defense-in-depth) —
  see `supabase/migrations/0002_rls_policies.sql` (SELECT) and
  `0005_rls_write_policies.sql` (INSERT/UPDATE/DELETE)
- Per-org query budgets + Edge Function rate limits mitigate noisy-neighbor risk

---

## 3. Architecture Overview (Phase 2 — COMPLETE)

**Full file:** `docs/ARCHITECTURE.md`

### Request Lifecycle

```
Client → proxy.ts (session refresh, route guard)
       → (app)/layout.tsx (resolve active org)
       → Page / Server Action
           ├── requireUser()           (session)
           ├── getActiveOrg()          (org context)
           ├── can(user, action, res)  (RBAC; throws 403)
           ├── prisma.$transaction(...)
           └── audit(LOG, ...)         (fire-and-forget)
```

### Folder Structure (abbreviated — see ARCHITECTURE.md)

```
saas-boilerplate/
├── .mcp.json                     # MCP servers (next-devtools, supabase, Prisma)
├── prisma/schema.prisma          # ⭐ Phase 2 deliverable
├── docs/ARCHITECTURE.md          # ⭐ Phase 2 deliverable
├── docs/MCP-SETUP.md             # ⭐ Phase 2 deliverable
├── context.md                    # THIS FILE
├── src/
│   ├── app/
│   │   ├── (marketing)/          # Public landing, pricing, blog
│   │   ├── (auth)/               # Supabase Auth UI + OAuth callback
│   │   ├── (app)/                # Org-scoped, guarded
│   │   │   ├── dashboard/
│   │   │   ├── agents/[id]/chat/  # Streaming AI chat
│   │   │   ├── knowledge-base/    # RAG upload + search
│   │   │   ├── usage/             # ⭐ AI cost dashboard
│   │   │   └── settings/          # members, billing, api-keys, webhooks, audit-log, compliance
│   │   └── api/
│   │       ├── chat/route.ts       # Streaming (Vercel AI SDK)
│   │       ├── embeddings/route.ts
│   │       ├── webhooks/{stripe,supabase}/route.ts
│   │       ├── livez/route.ts      # liveness probe
│   │       ├── readyz/route.ts     # readiness probe (checks DB)
│   │       ├── health/route.ts     # legacy alias for /api/livez
│   │       └── cron/{usage-meter,webhook-retry}/route.ts
│   ├── components/{ui,marketing,auth,dashboard,agents,knowledge-base,usage,settings,providers}/
│   ├── lib/{supabase,ai,auth,billing,audit,gdpr,webhooks,validators}/
│   ├── hooks/
│   ├── types/
│   ├── proxy.ts
│   └── config/
├── supabase/{migrations,functions,config.toml,seed.sql}
├── tests/{e2e,integration,unit}/
└── scripts/{setup.sh,seed.ts,deploy.sh}
```

### Key Lib Modules (real implementations, not stubs)

| Module | Responsibility |
|---|---|
| `lib/supabase/{client,server,admin,middleware}.ts` | Browser + RSC + service-role clients |
| `lib/prisma.ts` | Hot-reload-safe PrismaClient singleton |
| `lib/ai/{llm,embeddings,rag,stream,cost}.ts` | ⭐ `cost.ts` = the 5th USP |
| `lib/auth/{rbac,session,org-context,permissions}.ts` | Type-safe `can(user, action, resource)` |
| `lib/billing/{stripe,lemonsqueezy,plans,metering,webhooks}.ts` | Idempotent webhook reconciliation |
| `lib/audit/logger.ts` | Fire-and-forget audit writes |
| `lib/gdpr/{export,deletion}.ts` | ZIP export + cascade anonymization |
| `lib/webhooks/{dispatcher,signer,retry}.ts` | HMAC-signed outbound with backoff |

---

## 4. Agent Operating Instructions

**If you are an AI agent (Cursor/Cline/Claude Desktop) reading this file, follow these rules:**

### Conventions

- **TypeScript strict mode, zero `any`** — enforced via ESLint. Use `unknown` + type guards instead.
- **All tenant-scoped queries MUST filter by `organizationId`** — never query a tenant table without it. The RBAC layer enforces this; do not bypass.
- **Money is always `Int` cents** — format with `formatCurrency()` from `lib/utils.ts`.
- **All mutations write an `AuditLog` row** — use `lib/audit/logger.ts`. Fire-and-forget is OK.
- **Server Actions over API routes** where possible — App Router convention.
- **Validate all inputs with Zod** — schemas live in `lib/validators/`. Re-use, do not redefine.
- **Streaming AI goes through `lib/ai/stream.ts`** — never call OpenAI/Anthropic directly. Cost metering is enforced there.
- **Never commit secrets** — `.env.local` is gitignored. `.env.example` is the template.
- **Tests required for billing + RBAC + cost-metering code** — `src/lib/**/*.test.ts` (Vitest; see `vitest.config.ts`).

### Forbidden

- ❌ Calling Supabase service-role client from client components (`lib/supabase/admin.ts` is server-only)
- ❌ Bypassing `can(user, action, resource)` in any route
- ❌ Writing raw SQL when a Prisma method exists
- ❌ Using `parseFloat` for money — always `Int` cents
- ❌ Deleting data without an `AuditLog` entry
- ❌ Hardcoding model names — read from `ModelConfig` table
- ❌ Hardcoding a `planId` (or any other FK) instead of resolving it — a past
  version of `lib/billing/webhooks.ts` did exactly this with a fake
  `"default-plan-id"` and broke subscription creation for every new paying
  customer; see the Amendment Log below

### Recommended order of operations

When asked to add a feature:
1. Identify the domain (AI / Billing / Auth / Compliance / Integrations / Storage)
2. Read the relevant `lib/<domain>/` files
3. Read the relevant Prisma models
4. Add/modify Zod validator in `lib/validators/`
5. Implement the change
6. Add a test in `src/lib/**/*.test.ts`
7. Update `docs/CHANGELOG.md`

---

## 5. Phase Tracker

| Phase | Status | Notes |
|---|---|---|
| **Phase 1: Environment Setup & Discovery** | ✅ COMPLETE | `.mcp.json` created; discovery answered; GitHub auth wired via `gh` CLI |
| **Phase 2: Architecture & Schema Design** | ✅ COMPLETE | `prisma/schema.prisma` (24 models) + `docs/ARCHITECTURE.md` + `docs/MCP-SETUP.md` |
| **Phase 3: Implementation & Tooling** | ✅ SHIPPED | Full `src/app`, `src/lib`, Supabase migrations, CI, and setup/seed scripts exist and work. Ongoing hardening (bug fixes, RLS write policies, real test suite) continues on top of this. |
| **Phase 4: Productization & The Hook** | ✅ SHIPPED | `README.md` with badges, Quick Start, CTA all live. Commercial-license purchase link is still a placeholder — see `LICENSE`. |

This file previously said Phase 3 was still pending and "Repo: TBD" long
after both had actually happened — see the Amendment Log below. If you're
an agent reading this file, trust the Phase Tracker table above, the actual
`src/` tree, and `docs/CHANGELOG.md` over any phase language elsewhere in
this document that hasn't been updated to match.

---

## 6. Open Questions

| # | Question | Blocker for |
|---|---|---|
| 1 | ~~Final repo name?~~ | Resolved — `Next.js-SaaS` |
| 2 | License: MIT (permissive, more stars) or dual MIT/Commercial (resale-protected)? | Resolved — dual MIT/Commercial (see `LICENSE`), but the actual purchase link/email inside `LICENSE` and the README's Gumroad link are still unfilled placeholders |
| 3 | ~~Public or private repo?~~ | Resolved — public |
| 4 | Brand name for the boilerplate (e.g., "Nexus AI", "Cortex", "Loom")? | Still open — currently unbranded ("Next.js SaaS Boilerplate") |

---

## 7. Amendment Log

> Append-only. Use this when a past decision is reversed.

- **2026-08-09** — Corrected this file's Phase Tracker (§5) and TL;DR (§0),
  which still said Phase 3 was PENDING and the repo was "TBD" despite both
  having been done for weeks. Also corrected the Tailwind version in §0 from
  "v4" to the actually-pinned "v3.4" (the v4 upgrade is tracked as an open
  Dependabot PR, not yet merged — it's a real breaking-change migration).
  Same pass also fixed a critical bug this file's own "Forbidden" list (§4)
  now documents: `reconcileSubscription()` used to hardcode a fake
  `planId: "default-plan-id"`, which broke subscription creation for every
  new paying Stripe customer.

*Prior to this entry: no amendments.*

---

**Last updated:** 2026-08-09 hygiene + correctness pass
**Next update:** whenever the next Phase-level or architecturally significant change lands
