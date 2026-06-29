-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_enable_extensions.sql
-- Required Postgres extensions for the SaaS boilerplate.
-- Run after `prisma migrate deploy` — Prisma manages tables, we manage extensions.
-- ─────────────────────────────────────────────────────────────────────────────

-- pgvector — for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto — for gen_random_uuid() (Prisma default UUIDs)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pg_stat_statements — for query monitoring (optional, requires restart)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
