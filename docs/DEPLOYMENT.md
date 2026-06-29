# Deployment Guide

> Step-by-step go-live checklist for Vercel + Supabase + Stripe.

## 1. Supabase production setup

1. **Upgrade to Supabase Pro** ($25/mo) — required for:
   - Daily backups
   - No 7-day pause
   - 8GB DB (vs 500MB on free)
   - Custom domains

2. **Run migrations** in the Supabase SQL Editor:
   - `supabase/migrations/0001_enable_extensions.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_audit_trigger.sql`
   - `supabase/migrations/0004_vector_index.sql`

3. **Push Prisma schema**:
   ```bash
   pnpm db:deploy  # applies migrations
   pnpm db:seed    # populates plans, models, permissions
   ```

4. **Create a Storage bucket** named `uploads` (public read, authenticated write).

5. **Configure Auth providers**:
   - Email: enabled by default
   - GitHub OAuth: https://supabase.com/dashboard/project/_/auth/providers
   - Google OAuth: same URL

## 2. Vercel deployment

1. **Import the repo** at https://vercel.com/new
2. **Add env vars** (copy from `.env.example`):
   - All `NEXT_PUBLIC_*` vars
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` + `DIRECT_URL` (use Supabase connection pooler URL)
   - LLM API keys (at least one)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `CRON_SECRET` (generate with `openssl rand -hex 32`)
   - `WEBHOOK_SIGNING_SECRET`
3. **Deploy** — Vercel auto-detects Next.js.

## 3. Stripe setup

1. **Create products + prices** for each plan (Free, Starter, Pro, Enterprise)
2. **Update** `src/lib/billing/plans.ts` with the `stripePriceIdMonthly` and `stripePriceIdYearly` for each plan
3. **Configure webhook endpoint**:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
4. **Copy the webhook signing secret** to `STRIPE_WEBHOOK_SECRET`

## 4. Cloudflare Pages (free, commercial-OK alternative)

If you want to avoid Vercel's commercial-use restriction on the free tier:

1. Install the Cloudflare adapter: `pnpm add -D @opennextjs/cloudflare`
2. Add `wrangler.toml`:
   ```toml
   name = "nextjs-saas"
   compatibility_date = "2026-01-01"
   compatibility_flags = ["nodejs_compat"]
   ```
3. Build + deploy: `pnpm build && wrangler pages deploy .next`
4. Configure env vars in the Cloudflare dashboard.

## 5. Cron jobs

Set up these cron jobs in Vercel (`vercel.json`) or Cloudflare Cron:

```json
{
  "crons": [
    { "path": "/api/cron/usage-meter", "schedule": "0 0 * * *" },
    { "path": "/api/cron/webhook-retry", "schedule": "0-59/5 * * * *" }
  ]
}
```

Both endpoints require `Authorization: Bearer <CRON_SECRET>`.

## 6. Domain + DNS

1. Add your custom domain in Vercel/Cloudflare
2. Update `NEXT_PUBLIC_APP_URL` to your domain
3. Update Supabase Auth redirect URLs to include your domain
4. Update Stripe webhook URL to your domain

## 7. Post-deploy verification

- [ ] Visit `https://your-domain.com/api/health/ready` → returns `{"status":"ready"}`
- [ ] Sign up + create an org
- [ ] Create an agent + send a chat message
- [ ] Verify TokenUsage row created (check Supabase dashboard)
- [ ] Visit `/dashboard/usage` → shows the cost
- [ ] Configure Stripe webhook → test with `stripe trigger checkout.session.completed`
- [ ] Visit `/dashboard/settings/audit-log` → your actions are logged

🎉 You're live.
