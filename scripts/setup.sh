#!/usr/bin/env bash
# =============================================================================
# Next.js SaaS Boilerplate — One-shot setup script
#
# Usage:
#   bash scripts/setup.sh
#
# Does:
#   1. Checks Node + pnpm versions
#   2. Installs dependencies
#   3. Copies .env.example → .env.local (if not exists)
#   4. Generates Prisma client
#   5. Pushes schema to DB (if DATABASE_URL is set)
#   6. Seeds the DB with plans, models, permissions, demo data
#   7. Runs the dev server
#
# Prerequisites:
#   - Node.js 20+
#   - A Supabase project (https://supabase.com)
#   - .env.local populated with Supabase URL + anon key + service role key
# =============================================================================
set -e

echo "🚀 Setting up Next.js SaaS Boilerplate..."

# ── 1. Check Node ────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org (v20+)"
  exit 1
fi
NODE_VERSION=$(node -v | cut -dv -f2 | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js v20+ required (you have v$NODE_VERSION)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ── 2. Check pnpm ────────────────────────────────────────────
if ! command -v pnpm &> /dev/null; then
  echo "⚠️  pnpm not found. Installing..."
  npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# ── 3. Install deps ──────────────────────────────────────────
echo "📦 Installing dependencies..."
pnpm install

# ── 4. Copy .env.example ─────────────────────────────────────
if [ ! -f .env.local ]; then
  echo "📝 Copying .env.example → .env.local"
  cp .env.example .env.local
  echo ""
  echo "⚠️  Edit .env.local and fill in your Supabase credentials:"
  echo "      NEXT_PUBLIC_SUPABASE_URL"
  echo "      NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "      SUPABASE_SERVICE_ROLE_KEY"
  echo "      DATABASE_URL"
  echo "      DIRECT_URL"
  echo ""
  echo "   Get these from: https://supabase.com/dashboard/project/_/settings/api"
  echo ""
  echo "   Then re-run: bash scripts/setup.sh"
  exit 0
fi

# ── 5. Generate Prisma client ────────────────────────────────
echo "🔧 Generating Prisma client..."
pnpm db:generate

# ── 6. Check DB connection ───────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  source .env.local
fi

if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == *"your-project"* ]]; then
  echo "⚠️  DATABASE_URL not set in .env.local"
  echo "   Skipping DB push + seed. Edit .env.local and re-run this script."
  exit 0
fi

# ── 7. Push schema ───────────────────────────────────────────
echo "🗄️  Pushing schema to database..."
pnpm db:push

# ── 8. Run SQL migrations (RLS, vector index) ────────────────
echo "🔐 Applying RLS policies + vector index..."
echo "   Run these files in Supabase SQL Editor:"
echo "     supabase/migrations/0001_enable_extensions.sql"
echo "     supabase/migrations/0002_rls_policies.sql"
echo "     supabase/migrations/0003_audit_trigger.sql"
echo "     supabase/migrations/0004_vector_index.sql"

# ── 9. Seed ──────────────────────────────────────────────────
echo "🌱 Seeding database..."
pnpm db:seed

# ── 10. Done ─────────────────────────────────────────────────
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "   1. Apply the SQL migrations listed above in Supabase SQL Editor"
echo "   2. Start the dev server: pnpm dev"
echo "   3. Open http://localhost:3000"
echo ""
echo "Demo login (after seeding):"
echo "   Email: demo@example.com"
