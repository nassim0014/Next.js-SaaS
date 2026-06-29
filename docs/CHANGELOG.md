# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-01-XX

### Added

- **Multi-tenancy** — shared-DB with `organizationId` on every tenant-scoped table
- **RBAC** — 4 roles (OWNER, ADMIN, MEMBER, VIEWER) with type-safe `can(role, action)` checks
- **Audit logging** — every mutation logged with IP, user-agent, metadata
- **AI stack** — Vercel AI SDK with multi-provider support (Gemini, Groq, OpenAI, Anthropic)
- **RAG** — pgvector-powered knowledge base with HNSW index for fast retrieval
- **⭐ AI Cost Observability** — every LLM call metered, per-org budget caps, live `/usage` dashboard
- **Billing** — Stripe + Lemon Squeezy with idempotent webhook reconciliation
- **Metered usage** — `UsageRecord` rolls up `TokenUsage` nightly via cron
- **API keys** — argon2-hashed, revocable, with expiry + last-used tracking
- **Webhooks** — HMAC-signed outbound delivery with exponential backoff retry queue
- **GDPR compliance** — one-click data export (ZIP) + right-to-erasure with audit trail
- **MCP-ready** — `.mcp.json` pre-configured for Cursor / VS Code / Claude Desktop
- **Supabase Auth** — email/magic link/OAuth via `@supabase/ssr`
- **Row-Level Security** — every tenant table protected at the DB layer
- **Health endpoints** — `/api/health/live` + `/api/health/ready`
- **Cron jobs** — usage meter (nightly) + webhook retry (every 5 min)
- **Documentation** — ARCHITECTURE, MCP-SETUP, DEPLOYMENT, SECURITY, CONTRIBUTING

### Security

- Strict TypeScript (zero `any` rule enforced via ESLint)
- Service-role key never exposed to client bundle
- API keys hashed with argon2
- Webhook signatures verified with constant-time comparison
- HTTP security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

## [Unreleased]

### Planned

- Usage dashboard charts (Recharts)
- SSO/SAML for enterprise tier
- Realtime presence (Supabase Realtime)
- Edge Functions for hot-path queries
- White-label mode (custom branding per org)
