import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Bot, ShieldCheck, Activity, Webhook, KeyRound, ScrollText, Zap, Sparkles, Layers, ShieldCheckIcon } from "lucide-react";
import { Github } from "@/components/icons/github";

const FEATURES = [
  {
    icon: Bot,
    title: "AI-Native",
    description:
      "Streaming chat via Vercel AI SDK. Multi-provider (Gemini, OpenAI, Anthropic, Groq). RAG with pgvector out of the box.",
    tint: "text-primary bg-primary/10",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise RBAC + Audit",
    description:
      "Type-safe can(user, action, resource) checks. Every mutation logged to an immutable audit trail. GDPR export/erase built in.",
    tint: "text-info bg-info/10",
  },
  {
    icon: Activity,
    title: "AI Cost Observability",
    description:
      "Every LLM call metered to the cent. Per-org budget caps, usage-based billing, live /usage dashboard. Don't get burned by token bills.",
    tint: "text-success bg-success/10",
  },
  {
    icon: Webhook,
    title: "Webhooks + API Keys",
    description:
      "HMAC-signed outbound webhooks with exponential-backoff retry. Per-org API keys (argon2-hashed) for programmatic access.",
    tint: "text-warning bg-warning/10",
  },
  {
    icon: KeyRound,
    title: "Multi-Tenancy",
    description:
      "Shared-DB with organizationId everywhere. Supabase RLS as defense-in-depth. Per-org query budgets.",
    tint: "text-primary bg-primary/10",
  },
  {
    icon: ScrollText,
    title: "Billing Engine",
    description:
      "Stripe + Lemon Squeezy. Idempotent webhook reconciliation. Metered usage, not just a checkout button.",
    tint: "text-info bg-info/10",
  },
];

const STATS = [
  { icon: Layers, label: "6 systems pre-integrated" },
  { icon: Sparkles, label: "4 AI providers supported" },
  { icon: ShieldCheckIcon, label: "MIT / Commercial dual license" },
];

export default function MarketingHome() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo />
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
            <ModeToggle />
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-dot-grid opacity-40 [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-brand-radial" aria-hidden="true" />
        <div className="container relative flex flex-col items-center gap-6 py-24 text-center duration-700 animate-in fade-in slide-in-from-bottom-4">
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" />
            Next.js 16 · Supabase · Prisma · MCP-ready
          </Badge>
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
            Ship your AI SaaS in{" "}
            <span className="bg-brand-gradient bg-clip-text text-transparent">days</span>, not
            months.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A production-grade Next.js boilerplate for AI SaaS founders. Multi-tenancy, RBAC, and
            billing are wired in from day one — plus{" "}
            <strong className="text-foreground">AI cost observability</strong> so a runaway agent
            never turns into a surprise bill.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
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

          {/* ── Trust strip ──────────────────────────── */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-primary" />
                {stat.label}
              </div>
            ))}
          </div>

          {/* ── Product preview ──────────────────────── */}
          <div className="mt-8 w-full max-w-5xl">
            <div className="rounded-xl border bg-card p-1.5 shadow-2xl shadow-primary/10 ring-1 ring-border">
              {/* Fake browser chrome — grounds the screenshot as "the app", not a random image */}
              <div className="flex items-center gap-1.5 border-b px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-3 rounded-md bg-muted px-3 py-0.5 text-xs text-muted-foreground">
                  {siteConfig.url.replace(/^https?:\/\//, "")}/dashboard/chat
                </span>
              </div>
              <Image
                src="/screenshots/chat-preview.png"
                alt="The AI chat interface — agent picker, streaming responses, and conversation history"
                width={1400}
                height={560}
                className="w-full rounded-b-[calc(0.75rem-6px)]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="container py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mt-3 text-muted-foreground">
            Six systems that would take 4–6 weeks each to build from scratch. Pre-integrated,
            type-safe, and battle-tested patterns.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="rounded-lg border bg-card p-6 text-card-foreground transition-shadow duration-700 animate-in fade-in slide-in-from-bottom-4 hover:border-primary/30 hover:shadow-md"
              style={{ animationDelay: `${i * 75}ms`, animationFillMode: "backwards" }}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${feature.tint}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Preview ────────────────────────────── */}
      <section className="container py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
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

            const card = (
              <div className="relative h-full rounded-[calc(0.5rem-1.5px)] bg-card p-6">
                {plan.highlight && (
                  <Badge className="absolute -top-3 left-6 border-0 bg-brand-gradient">
                    Most Popular
                  </Badge>
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

            // Highlighted plan gets a real gradient border via the classic
            // "padding wrapper" technique: an outer div paints the gradient,
            // a 1.5px inset inner div paints the solid card background over
            // all but a thin gradient sliver.
            return plan.highlight ? (
              <div
                key={slug}
                className="rounded-lg bg-brand-gradient p-[1.5px] shadow-lg shadow-primary/20"
              >
                {card}
              </div>
            ) : (
              <div key={slug} className="rounded-lg border">
                {card}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="container relative py-24">
        <div
          className="absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[100px]"
          aria-hidden="true"
        />
        <div className="rounded-2xl bg-brand-gradient p-12 text-center text-primary-foreground shadow-xl shadow-primary/20">
          <h2 className="text-3xl font-bold">Ready to ship?</h2>
          <p className="mt-3 text-primary-foreground/80">
            Clone the repo, run{" "}
            <code className="rounded bg-primary-foreground/10 px-1">./scripts/setup.sh</code>, and
            you&apos;re live in under 2 minutes.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Get started free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="mt-auto border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Dual MIT/Commercial license.
          </p>
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
