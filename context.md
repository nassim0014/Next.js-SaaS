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
| **Project name** | `ai-saas-boilerplate` (placeholder — confirm in Phase 3) |
| **Niche** | AI-powered SaaS — RAG chatbot / agent platform wrapper |
| **Primary audience** | Enterprise leads + recruiters evaluating production-grade patterns |
| **Monetization** | Gumroad / Lemon Squeezy, $49–$299 tier |
| **Stack** | Next.js 16+ · Supabase (Auth, DB, RLS, Storage, Realtime, Edge, pgvector) · Prisma · Vercel AI SDK · shadcn/ui + Tailwind v4 · Stripe + Lemon Squeezy · Vitest + Playwright |
| **Current phase** | Phase 2 of 4 — Architecture & Schema Design (COMPLETE) |
| **Next phase** | Phase 3 — Implementation & Tooling |
| **GitHub owner** | `nassim0014` |
| **Repo** | TBD — created in Phase 3 |
| **MCP editor (user)** | Linux, free plan — VS Code + Cline recommended (see `docs/MCP-SETUP.md`) |

---

## 1. Discovery Decisions (Phase 1 — COMPLETE)

Locked-in answers from the discovery questionnaire:

1. **Niche:** AI-powered SaaS (RAG chatbot / agent platform wrapper)
2. **Audience:** Enterprise leads who need to see production-grade patterns (RBAC, audit logs, multi-tenancy)
3. **Supabase features:** ALL — Auth, DB, RLS, Storage, Realtime, Edge Functions, pgvector
4. **Prisma schema:** Designed by the architect — 21 models across 7 domains
5. **USPs (the "Hook"):**
   - **USP 1:** RBAC + audit logging + GDPR data-export out of the box
   - **USP 2:** MCP-native — `.mcp.json` wired for Cursor/Claude Desktop so buyers AI-develop on top instantly
   - **USP 3:** Stripe + Lemon Squeezy billing engine with webhook reconciliation (not just a checkout button)
   - **USP 4:** Type-safe end-to-end (Zod → Prisma → server actions → React, zero `any`)
   - **USP 5 (creative, ⭐):** **AI Cost Observability** — every LLM call metered to the cent, per-org budget caps, usage-based overage billing, live `/usage` dashboard

**Bonus context:**
- Billing: Stripe (primary) + Lemon Squeezy (alt, MoR for EU)
- UI: shadcn/ui (default) + Tailwind v4
- TypeScript: strict mode + zero-`any` ESLint rule
- E2E: Playwright

---

## 2. Schema Overview (Phase 2 — COMPLETE)

**File:** `prisma/schema.prisma` (21 models)

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
- RLS policies on Supabase enforce isolation at the DB layer (defense-in-depth)
- Per-org query budgets + Edge Function rate limits mitigate noisy-neighbor risk

---

## 3. Architecture Overview (Phase 2 — COMPLETE)

**Full file:** `docs/ARCHITECTURE.md`

### Request Lifecycle

```
Client → middleware.ts (session refresh, route guard)
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
│   │       ├── health/route.ts     # /api/livez + /api/readyz
│   │       └── cron/{usage-meter,webhook-retry}/route.ts
│   ├── components/{ui,marketing,auth,dashboard,agents,knowledge-base,usage,settings,providers}/
│   ├── lib/{supabase,ai,auth,billing,audit,gdpr,webhooks,validators}/
│   ├── hooks/
│   ├── types/
│   ├── middleware.ts
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
- **Tests required for billing + RBAC + cost-metering code** — `tests/{integration,unit}/`.

### Forbidden

- ❌ Calling Supabase service-role client from client components (`lib/supabase/admin.ts` is server-only)
- ❌ Bypassing `can(user, action, resource)` in any route
- ❌ Writing raw SQL when a Prisma method exists
- ❌ Using `parseFloat` for money — always `Int` cents
- ❌ Deleting data without an `AuditLog` entry
- ❌ Hardcoding model names — read from `ModelConfig` table

### Recommended order of operations

When asked to add a feature:
1. Identify the domain (AI / Billing / Auth / Compliance / Integrations / Storage)
2. Read the relevant `lib/<domain>/` files
3. Read the relevant Prisma models
4. Add/modify Zod validator in `lib/validators/`
5. Implement the change
6. Add a test in `tests/`
7. Update `docs/CHANGELOG.md`

---

## 5. Phase Tracker

| Phase | Status | Notes |
|---|---|---|
| **Phase 1: Environment Setup & Discovery** | ✅ COMPLETE | `.mcp.json` created; discovery answered; GitHub auth wired via `gh` CLI |
| **Phase 2: Architecture & Schema Design** | ✅ COMPLETE | `prisma/schema.prisma` (21 models) + `docs/ARCHITECTURE.md` + `docs/MCP-SETUP.md` |
| **Phase 3: Implementation & Tooling** | ⏳ PENDING | Next — scaffold Next.js 16+, install deps, build core files, push to GitHub |
| **Phase 4: Productization & The Hook** | ⏳ PENDING | `README.md` with badges, Quick Start, CTA |

---

## 6. Open Questions

| # | Question | Blocker for |
|---|---|---|
| 1 | Final repo name? Default suggestion: `ai-saas-boilerplate` | Phase 3 git push |
| 2 | License: MIT (permissive, more stars) or dual MIT/Commercial (resale-protected)? | Phase 4 README |
| 3 | Public or private repo? Affects README tone (private = enterprise sales asset) | Phase 3 git push |
| 4 | Brand name for the boilerplate (e.g., "Nexus AI", "Cortex", "Loom")? | Phase 4 README + landing page |

---

## 7. Amendment Log

> Append-only. Use this when a past decision is reversed.

*No amendments yet.*

---

**Last updated:** Phase 2 completion
**Next update:** Phase 3 start (after user green-lights implementation)
