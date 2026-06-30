-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_audit_trigger.sql
--
-- Auto-populate created_at + updated_at on every row.
-- Prisma handles this client-side, but DB triggers ensure consistency even
-- for raw SQL inserts (e.g., from Edge Functions or admin scripts).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to every table with an updated_at column
-- Idempotent: DROP TRIGGER IF EXISTS before CREATE so re-running is safe.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
      ', t, t);
  END LOOP;
END;
$$;
