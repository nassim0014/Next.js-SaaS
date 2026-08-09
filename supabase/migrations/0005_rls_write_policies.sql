-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_rls_write_policies.sql
--
-- INSERT/UPDATE/DELETE companions to the SELECT-only policies in
-- 0002_rls_policies.sql, plus a fix for `invitations`, which had RLS
-- enabled with no policies defined at all (not even SELECT) — under real
-- RLS enforcement that table was completely inaccessible.
--
-- SCOPE: write policies are added for tables where a user acting through a
-- session-scoped Supabase client (not the app's Prisma connection, which by
-- default uses a superuser role that bypasses RLS entirely — see
-- .env.example) would plausibly need to write directly: collaborative
-- content (agents, conversations, knowledge bases, documents) and
-- self-service settings (memberships, invitations, api keys, webhook
-- endpoints, file assets).
--
-- DELIBERATELY OMITTED: audit_logs, billing_events, token_usage,
-- subscriptions, usage_records, webhook_events. These are system-of-record
-- tables written exclusively by the app's server-side logic (metering,
-- billing webhook reconciliation, audit trail, webhook delivery tracking).
-- They already have SELECT policies from 0002; giving authenticated users
-- direct INSERT/UPDATE/DELETE on them would weaken, not strengthen, the
-- security posture this migration is meant to improve.
--
-- IDEMPOTENT: every CREATE POLICY is preceded by DROP POLICY IF EXISTS,
-- matching 0002's convention.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Fix: invitations had RLS enabled but no policies at all ───────────────
-- Visible to: the invited email's own user (once they've signed up) and
-- members of the org that sent the invite.
DROP POLICY IF EXISTS invitations_select ON invitations;
CREATE POLICY invitations_select ON invitations
  FOR SELECT USING (
    is_org_member(organization_id)
    OR email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- ─── Memberships ─────────────────────────────────────────────────────────
-- INSERT already exists in 0002 (memberships_insert). Add update/delete:
-- org admins manage roles/removal; a user can also remove themselves
-- (leave an org).
DROP POLICY IF EXISTS memberships_update ON memberships;
CREATE POLICY memberships_update ON memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = memberships.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS memberships_delete ON memberships;
CREATE POLICY memberships_delete ON memberships
  FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = memberships.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- ─── Invitations ─────────────────────────────────────────────────────────
-- Only org admins can invite / revoke / update invitations.
DROP POLICY IF EXISTS invitations_insert ON invitations;
CREATE POLICY invitations_insert ON invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = invitations.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS invitations_update ON invitations;
CREATE POLICY invitations_update ON invitations
  FOR UPDATE USING (
    -- The invited user accepting their own invite, or an org admin editing it.
    email = (SELECT email FROM users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = invitations.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS invitations_delete ON invitations;
CREATE POLICY invitations_delete ON invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = invitations.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- ─── Agents ──────────────────────────────────────────────────────────────
-- Mirrors agents_select's scoping (any active org member) — the app-layer
-- can(user, "agents:create"/"agents:update") RBAC check is the primary
-- gate; this is defense-in-depth, not a replacement for it.
DROP POLICY IF EXISTS agents_insert ON agents;
CREATE POLICY agents_insert ON agents
  FOR INSERT WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS agents_update ON agents;
CREATE POLICY agents_update ON agents
  FOR UPDATE USING (is_org_member(organization_id));

DROP POLICY IF EXISTS agents_delete ON agents;
CREATE POLICY agents_delete ON agents
  FOR DELETE USING (is_org_member(organization_id));

-- ─── Conversations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS conversations_insert ON conversations;
CREATE POLICY conversations_insert ON conversations
  FOR INSERT WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS conversations_update ON conversations;
CREATE POLICY conversations_update ON conversations
  FOR UPDATE USING (
    is_org_member(organization_id) AND (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = conversations.organization_id
          AND m.role IN ('OWNER', 'ADMIN')
      )
    )
  );

DROP POLICY IF EXISTS conversations_delete ON conversations;
CREATE POLICY conversations_delete ON conversations
  FOR DELETE USING (
    is_org_member(organization_id) AND (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = conversations.organization_id
          AND m.role IN ('OWNER', 'ADMIN')
      )
    )
  );

-- ─── Messages ────────────────────────────────────────────────────────────
-- INSERT only — chat history is treated as append-only/immutable once
-- written, matching normal chat-product semantics (no user-facing "edit a
-- past message" feature exists in the app).
DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND is_org_member(c.organization_id)
    )
  );

-- ─── Knowledge bases / documents / embeddings ───────────────────────────
DROP POLICY IF EXISTS knowledge_bases_insert ON knowledge_bases;
CREATE POLICY knowledge_bases_insert ON knowledge_bases
  FOR INSERT WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS knowledge_bases_update ON knowledge_bases;
CREATE POLICY knowledge_bases_update ON knowledge_bases
  FOR UPDATE USING (is_org_member(organization_id));

DROP POLICY IF EXISTS knowledge_bases_delete ON knowledge_bases;
CREATE POLICY knowledge_bases_delete ON knowledge_bases
  FOR DELETE USING (is_org_member(organization_id));

DROP POLICY IF EXISTS documents_insert ON documents;
CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_bases kb
      WHERE kb.id = documents.knowledge_base_id
        AND is_org_member(kb.organization_id)
    )
  );

DROP POLICY IF EXISTS documents_update ON documents;
CREATE POLICY documents_update ON documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases kb
      WHERE kb.id = documents.knowledge_base_id
        AND is_org_member(kb.organization_id)
    )
  );

DROP POLICY IF EXISTS documents_delete ON documents;
CREATE POLICY documents_delete ON documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases kb
      WHERE kb.id = documents.knowledge_base_id
        AND is_org_member(kb.organization_id)
    )
  );

-- Embeddings: insert/delete (regenerate-by-replace), no update — chunks are
-- write-once, re-chunking deletes and re-inserts rather than editing in place.
DROP POLICY IF EXISTS embeddings_insert ON embeddings;
CREATE POLICY embeddings_insert ON embeddings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id
      WHERE d.id = embeddings.document_id
        AND is_org_member(kb.organization_id)
    )
  );

DROP POLICY IF EXISTS embeddings_delete ON embeddings;
CREATE POLICY embeddings_delete ON embeddings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id
      WHERE d.id = embeddings.document_id
        AND is_org_member(kb.organization_id)
    )
  );

-- ─── API keys ────────────────────────────────────────────────────────────
-- Users manage their own keys. No UPDATE policy — keys are revoked
-- (status change) by the owner, matching api_keys_select's "own keys or
-- OWNER" scoping; revocation goes through the same actor set as delete.
DROP POLICY IF EXISTS api_keys_insert ON api_keys;
CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS api_keys_update ON api_keys;
CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = api_keys.organization_id
        AND m.role = 'OWNER'
    )
  );

DROP POLICY IF EXISTS api_keys_delete ON api_keys;
CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = api_keys.organization_id
        AND m.role = 'OWNER'
    )
  );

-- ─── Webhook endpoints ───────────────────────────────────────────────────
-- Admin-only, matching the app-layer "webhooks:create" permission which is
-- restricted to OWNER/ADMIN in src/lib/auth/permissions.ts.
DROP POLICY IF EXISTS webhook_endpoints_insert ON webhook_endpoints;
CREATE POLICY webhook_endpoints_insert ON webhook_endpoints
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = webhook_endpoints.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS webhook_endpoints_update ON webhook_endpoints;
CREATE POLICY webhook_endpoints_update ON webhook_endpoints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = webhook_endpoints.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS webhook_endpoints_delete ON webhook_endpoints;
CREATE POLICY webhook_endpoints_delete ON webhook_endpoints
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = webhook_endpoints.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- ─── File assets ─────────────────────────────────────────────────────────
-- Insert/delete by org members (upload / remove an upload). No UPDATE —
-- file metadata is treated as immutable once written; replacing a file
-- means uploading a new asset, not editing the row.
DROP POLICY IF EXISTS file_assets_insert ON file_assets;
CREATE POLICY file_assets_insert ON file_assets
  FOR INSERT WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS file_assets_delete ON file_assets;
CREATE POLICY file_assets_delete ON file_assets
  FOR DELETE USING (is_org_member(organization_id));

-- ─── Data requests ───────────────────────────────────────────────────────
-- A user may file their own GDPR export/deletion request directly. No
-- UPDATE/DELETE for end users — status transitions (PENDING → COMPLETED)
-- are written by the app's server-side GDPR logic (lib/gdpr/), and request
-- records shouldn't be editable/removable by the user who filed them
-- (that would undermine the audit trail these exist to provide).
DROP POLICY IF EXISTS data_requests_insert ON data_requests;
CREATE POLICY data_requests_insert ON data_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
