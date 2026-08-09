import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Check } from "lucide-react";

const FAQ = [
  {
    question: "Can I switch plans later?",
    answer:
      "Yes — upgrade or downgrade anytime from your dashboard's billing settings. Changes are prorated automatically via Stripe.",
  },
  {
    question: "What happens if I go over my token quota?",
    answer:
      "You'll get an alert at 80% and 100% of your monthly quota. Usage past that is billed as metered overage, not a hard cutoff — your app keeps working.",
  },
  {
    question: "Is this a subscription to your service, or code I own?",
    answer:
      "It's a boilerplate you clone and deploy yourself, on your own Supabase and hosting accounts. The plans above describe what buyers typically charge their own end users, not a fee you pay us monthly.",
  },
  {
    question: "MIT or Commercial license — which do I need?",
    answer:
      "MIT is free for personal/learning/open-source use. A Commercial license is required if you sell a product built on this or use it internally at a company with more than 5 developers.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade only when your customers are paying you.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((slug) => {
            const plan = PLANS[slug];
            const priceLabel =
              plan.priceMonthly === -1
                ? "Custom"
                : plan.priceMonthly === 0
                  ? "$0"
                  : formatCurrency(plan.priceMonthly);

            const card = (
              <Card className="h-full border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlight && (
                      <Badge className="border-0 bg-brand-gradient">Most Popular</Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold">
                    {priceLabel}
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/signup">
                      {plan.priceMonthly === 0
                        ? "Start Free"
                        : plan.priceMonthly === -1
                          ? "Contact Sales"
                          : "Get Started"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );

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

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include: multi-tenancy, RBAC, audit logs, webhooks, API keys, and MCP support.
          </p>
        </div>

        {/* ── FAQ ────────────────────────────────────── */}
        <div className="mx-auto mt-24 max-w-2xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
