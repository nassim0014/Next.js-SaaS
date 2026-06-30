-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_rls_policies.sql
--
-- Row-Level Security policies for every tenant-scoped table.
--
-- Defense-in-depth: even if the app layer has a bug and forgets to filter by
-- organizationId, the database refuses to return rows from another org.
--
-- Strategy:
--   1. Enable RLS on every tenant-scoped table
--   2. Policy: users can only see rows where organization_id matches an org
--      they're an active member of
--   3. The app uses the service-role key for cross-tenant operations (admin,
--      cron, webhooks) — RLS is bypassed
--
-- IDEMPOTENT: This migration is safe to re-run. Every CREATE POLICY is
-- preceded by a DROP POLICY IF EXISTS, so existing policies are replaced
-- rather than causing "already exists" errors on re-application.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function: check if the current user is an active member of an org
CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE u.id = auth.uid()
      AND m.organization_id = target_org_id
      AND m.status = 'ACTIVE'
  );
$$;

-- ─── Enable RLS on tenant-scoped tables ─────────────────────────────────────

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_assets ENABLE ROW LEVEL SECURITY;

-- ─── Policies ───────────────────────────────────────────────────────────────

-- Memberships: users can see their own memberships + memberships in their orgs
DROP POLICY IF EXISTS memberships_select ON memberships;
CREATE POLICY memberships_select ON memberships
  FOR SELECT USING (
    user_id = auth.uid() OR is_org_member(organization_id)
  );

DROP POLICY IF EXISTS memberships_insert ON memberships;
CREATE POLICY memberships_insert ON memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Agents: only visible to org members
DROP POLICY IF EXISTS agents_select ON agents;
CREATE POLICY agents_select ON agents
  FOR SELECT USING (is_org_member(organization_id));

-- Conversations: users see their own conversations within orgs they belong to
DROP POLICY IF EXISTS conversations_select ON conversations;
CREATE POLICY conversations_select ON conversations
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = conversations.organization_id
          AND m.role IN ('OWNER', 'ADMIN')
      )
    )
  );

-- Messages: visible if the user can see the parent conversation
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND is_org_member(c.organization_id)
    )
  );

-- Knowledge bases + documents + embeddings: org-scoped
DROP POLICY IF EXISTS knowledge_bases_select ON knowledge_bases;
CREATE POLICY knowledge_bases_select ON knowledge_bases
  FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases kb
      WHERE kb.id = documents.knowledge_base_id
        AND is_org_member(kb.organization_id)
    )
  );

DROP POLICY IF EXISTS embeddings_select ON embeddings;
CREATE POLICY embeddings_select ON embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id
      WHERE d.id = embeddings.document_id
        AND is_org_member(kb.organization_id)
    )
  );

-- Token usage: users see their own usage within orgs
DROP POLICY IF EXISTS token_usage_select ON token_usage;
CREATE POLICY token_usage_select ON token_usage
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = token_usage.organization_id
          AND m.role IN ('OWNER', 'ADMIN')
      )
    )
  );

-- Subscriptions, billing events, usage records: org admins only
DROP POLICY IF EXISTS subscriptions_select ON subscriptions;
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS billing_events_select ON billing_events;
CREATE POLICY billing_events_select ON billing_events
  FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS usage_records_select ON usage_records;
CREATE POLICY usage_records_select ON usage_records
  FOR SELECT USING (is_org_member(organization_id));

-- Audit logs: org admins only
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    is_org_member(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = audit_logs.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- API keys: users see only their own keys
DROP POLICY IF EXISTS api_keys_select ON api_keys;
CREATE POLICY api_keys_select ON api_keys
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = api_keys.organization_id
        AND m.role = 'OWNER'
    )
  );

-- Webhook endpoints + events: org members
DROP POLICY IF EXISTS webhook_endpoints_select ON webhook_endpoints;
CREATE POLICY webhook_endpoints_select ON webhook_endpoints
  FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS webhook_events_select ON webhook_events;
CREATE POLICY webhook_events_select ON webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhook_endpoints we
      WHERE we.id = webhook_events.endpoint_id
        AND is_org_member(we.organization_id)
    )
  );

-- Data requests: user's own requests + org admins
DROP POLICY IF EXISTS data_requests_select ON data_requests;
CREATE POLICY data_requests_select ON data_requests
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = data_requests.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- File assets: org members
DROP POLICY IF EXISTS file_assets_select ON file_assets;
CREATE POLICY file_assets_select ON file_assets
  FOR SELECT USING (is_org_member(organization_id));
