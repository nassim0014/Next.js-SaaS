import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/utils";
import { Check } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="font-bold text-xl">Next.js SaaS</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Button asChild size="sm"><Link href="/signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade only when your customers are paying you.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((slug) => {
            const plan = PLANS[slug];
            const priceLabel = plan.priceMonthly === -1
              ? "Custom"
              : plan.priceMonthly === 0
              ? "$0"
              : formatCurrency(plan.priceMonthly);
            return (
              <Card key={slug} className={plan.highlight ? "border-primary shadow-md" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlight && <Badge>Most Popular</Badge>}
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
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6"
                    variant={plan.highlight ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/signup">
                      {plan.priceMonthly === 0 ? "Start Free" : plan.priceMonthly === -1 ? "Contact Sales" : "Get Started"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include: multi-tenancy, RBAC, audit logs, webhooks, API keys, and MCP support.
          </p>
        </div>
      </section>
    </div>
  );
}
