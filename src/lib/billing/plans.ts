/**
 * Plan definitions — the single source of truth for plan features.
 *
 * This file is mirrored in the `Plan` table (seeded by `prisma/seed.ts`).
 * When changing plans, update BOTH this file AND the seed.
 */

export type PlanSlug = "free" | "starter" | "pro" | "enterprise";

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  description: string;
  priceMonthly: number; // cents
  priceYearly: number; // cents
  tokenQuota: number; // monthly tokens, -1 for unlimited
  seatQuota: number;
  storageQuotaMb: number;
  features: string[];
  highlight?: boolean; // Show as "Most Popular" on pricing page
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
};

export const PLANS: Record<PlanSlug, PlanDefinition> = {
  free: {
    slug: "free",
    name: "Free",
    description: "For trying out the platform",
    priceMonthly: 0,
    priceYearly: 0,
    tokenQuota: 50_000,
    seatQuota: 1,
    storageQuotaMb: 100,
    features: [
      "1 seat",
      "50K tokens / month",
      "100 MB storage",
      "1 agent",
      "Community support",
    ],
  },
  starter: {
    slug: "starter",
    name: "Starter",
    description: "For indie builders shipping their first AI app",
    priceMonthly: 1900, // $19
    priceYearly: 19000, // $190 (2 months free)
    tokenQuota: 500_000,
    seatQuota: 3,
    storageQuotaMb: 1024,
    features: [
      "3 seats",
      "500K tokens / month",
      "1 GB storage",
      "Unlimited agents",
      "Webhooks",
      "Email support",
    ],
  },
  pro: {
    slug: "pro",
    name: "Pro",
    description: "For teams running AI SaaS in production",
    priceMonthly: 4900, // $49
    priceYearly: 49000, // $490
    tokenQuota: 5_000_000,
    seatQuota: 10,
    storageQuotaMb: 10240,
    features: [
      "10 seats",
      "5M tokens / month",
      "10 GB storage",
      "Unlimited agents + KBs",
      "Audit logs (90 days)",
      "API keys",
      "Priority support",
    ],
    highlight: true,
  },
  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    description: "For organizations with compliance requirements",
    priceMonthly: -1, // Contact sales
    priceYearly: -1,
    tokenQuota: -1, // Unlimited
    seatQuota: -1,
    storageQuotaMb: -1,
    features: [
      "Unlimited seats",
      "Unlimited tokens",
      "Unlimited storage",
      "SSO + SAML",
      "Audit logs (1 year retention)",
      "Custom RBAC",
      "SLA + dedicated support",
      "On-prem deployment option",
    ],
  },
};

export const PLAN_ORDER: PlanSlug[] = ["free", "starter", "pro", "enterprise"];

/**
 * Get a plan by its slug. Throws if not found.
 */
export function getPlan(slug: string): PlanDefinition {
  const plan = PLANS[slug as PlanSlug];
  if (!plan) throw new Error(`Unknown plan: ${slug}`);
  return plan;
}

/**
 * List all plans in display order.
 */
export function listPlans(): PlanDefinition[] {
  return PLAN_ORDER.map((slug) => PLANS[slug]);
}
