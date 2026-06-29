# Cloudflare Pages Deployment

> Deploy this boilerplate to Cloudflare Pages for free + commercial-OK hosting.
> Vercel's free Hobby tier prohibits commercial use; Cloudflare Pages does not.

## Why Cloudflare Pages?

| | Vercel Hobby | Cloudflare Pages |
|---|---|---|
| Free tier | ✅ | ✅ |
| Commercial use on free | ❌ (ToS violation) | ✅ |
| Bandwidth | 100 GB/mo | Unlimited |
| Build minutes | 6,000/mo | 500/mo |
| Edge network | ✅ | ✅ (faster in some regions) |
| Next.js support | Native | Via `@opennextjs/cloudflare` |

## Prerequisites

1. A Cloudflare account (free): https://dash.cloudflare.com/sign-up
2. The boilerplate repo cloned locally
3. All env vars ready (see `.env.example`)

## Option A — Deploy via Cloudflare Dashboard (easiest)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
2. Select your `nassim0014/Next.js-SaaS` GitHub repo
3. Configure build:
   - **Framework preset:** Next.js
   - **Build command:** `npx @opennextjs/cloudflare && pnpm build`
   - **Build output directory:** `.open-next`
   - **Node version:** 20 (set `NODE_VERSION=20` env var)
4. Add environment variables (Settings → Environment variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (use Supabase connection pooler URL)
   - `DIRECT_URL` (same as DATABASE_URL for Supabase)
   - `GOOGLE_GENERATIVE_AI_API_KEY` (or other LLM provider key)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `CRON_SECRET` (generate with `openssl rand -hex 32`)
   - `WEBHOOK_SIGNING_SECRET`
   - `NODE_VERSION=20`
5. Save + Deploy. First build takes 3–5 minutes.

## Option B — Deploy via Wrangler CLI

```bash
# 1. Install wrangler
pnpm add -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Build the project
pnpm build

# 4. Deploy
wrangler pages deploy .open-next --project-name=nextjs-saas
```

## Configure environment variables

After the first deploy, set your env vars in the Cloudflare dashboard (Workers & Pages → your project → Settings → Environment variables). They are NOT read from `.env.local` in production — they must be set in Cloudflare.

## Set up custom domain

1. In Cloudflare Pages → your project → Custom domains → Set up a domain
2. Add `your-saas-demo.com` (or whatever domain you own)
3. Cloudflare auto-provisions SSL
4. Update `NEXT_PUBLIC_APP_URL` to your domain
5. Update Supabase Auth redirect URLs to include your domain
6. Update Stripe webhook URL to `https://your-domain.com/api/webhooks/stripe`

## Set up cron jobs

Cloudflare Cron Triggers fire on a schedule and hit your API routes:

1. In `wrangler.toml`, add:
   ```toml
   [triggers]
   crons = ["0 0 * * *", "0-59/5 * * * *"]
   ```
2. Or configure in dashboard: Workers & Pages → your project → Triggers → Cron Triggers
3. Both routes (`/api/cron/usage-meter`, `/api/cron/webhook-retry`) require the `Authorization: Bearer <CRON_SECRET>` header — Cloudflare Cron Triggers can be configured to send custom headers.

## Verify the deployment

- [ ] Visit `https://your-project.pages.dev/api/health/ready` → returns `{"status":"ready"}`
- [ ] Visit `https://your-project.pages.dev/` → marketing landing renders
- [ ] Sign up + create org → redirects to `/dashboard`
- [ ] Create an agent + chat → token usage appears in `/dashboard/usage`

## Known limitations on Cloudflare

- **Edge runtime** — some Node.js modules may not work; we've kept the code Node-compatible
- **Build memory** — Cloudflare's build environment has 3GB RAM limit; the boilerplate fits comfortably
- **No persistent filesystem** — files must use Supabase Storage (we already do)

## Rollback

Cloudflare Pages keeps every deployment. To rollback:

1. Go to your project → Deployments
2. Find the last working deployment
3. Click "Rollback to this deployment"

Instant — no rebuild required.
