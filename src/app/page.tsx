import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/utils";
import {
  Bot,
  ShieldCheck,
  Activity,
  Webhook,
  KeyRound,
  ScrollText,
  Zap,
  Github,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI-Native",
    description:
      "Streaming chat via Vercel AI SDK. Multi-provider (Gemini, OpenAI, Anthropic, Groq). RAG with pgvector out of the box.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise RBAC + Audit",
    description:
      "Type-safe can(user, action, resource) checks. Every mutation logged to an immutable audit trail. GDPR export/erase built in.",
  },
  {
    icon: Activity,
    title: "AI Cost Observability",
    description:
      "Every LLM call metered to the cent. Per-org budget caps, usage-based billing, live /usage dashboard. Don't get burned by token bills.",
  },
  {
    icon: Webhook,
    title: "Webhooks + API Keys",
    description:
      "HMAC-signed outbound webhooks with exponential-backoff retry. Per-org API keys (argon2-hashed) for programmatic access.",
  },
  {
    icon: KeyRound,
    title: "Multi-Tenancy",
    description:
      "Shared-DB with organizationId everywhere. Supabase RLS as defense-in-depth. Per-org query budgets.",
  },
  {
    icon: ScrollText,
    title: "Billing Engine",
    description:
      "Stripe + Lemon Squeezy. Idempotent webhook reconciliation. Metered usage, not just a checkout button.",
  },
];

export default function MarketingHome() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Bot className="h-6 w-6" />
            {siteConfig.name}
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button asChild variant="outline" size="icon">
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="container flex flex-col items-center gap-6 py-24 text-center">
        <Badge variant="secondary" className="gap-1">
          <Zap className="h-3 w-3" />
          Next.js 16 · Supabase · Prisma · MCP-ready
        </Badge>
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
          Ship your AI SaaS in <span className="text-primary">days</span>, not months.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          The production-grade Next.js SaaS boilerplate. Multi-tenant. AI-native. With{" "}
          <strong>AI cost observability</strong> that prevents the token-bill surprises every
          founder dreads.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Start for free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" />
              Star on GitHub
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          No credit card required · Launch for $0 on free tiers
        </p>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Everything you need, nothing you don&apos;t</h2>
          <p className="mt-3 text-muted-foreground">
            Six systems that would take 4–6 weeks each to build from scratch. Pre-integrated,
            type-safe, and battle-tested patterns.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border bg-card p-6 text-card-foreground transition-shadow hover:shadow-md"
            >
              <feature.icon className="h-10 w-10 mb-4 text-primary" />
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Preview ────────────────────────────── */}
      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade only when your customers are paying you.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {PLAN_ORDER.map((slug) => {
            const plan = PLANS[slug];
            const priceLabel =
              plan.priceMonthly === -1
                ? "Custom"
                : plan.priceMonthly === 0
                ? "$0"
                : formatCurrency(plan.priceMonthly);
            return (
              <div
                key={slug}
                className={`relative rounded-lg border p-6 ${
                  plan.highlight ? "border-primary shadow-md" : ""
                }`}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-3 left-6">Most Popular</Badge>
                )}
                <h3 className="font-semibold">{plan.name}</h3>
                <div className="mt-2 text-3xl font-bold">
                  {priceLabel}
                  {plan.priceMonthly > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="container py-24">
        <div className="rounded-2xl border bg-primary text-primary-foreground p-12 text-center">
          <h2 className="text-3xl font-bold">Ready to ship?</h2>
          <p className="mt-3 text-primary-foreground/80">
            Clone the repo, run <code className="rounded bg-primary-foreground/10 px-1">./scripts/setup.sh</code>, and you&apos;re live in under 2 minutes.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Get started free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t py-8 mt-auto">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {siteConfig.name}. Dual MIT/Commercial license.</p>
          <div className="flex gap-4">
            <Link href="/docs">Docs</Link>
            <Link href="/pricing">Pricing</Link>
            <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
