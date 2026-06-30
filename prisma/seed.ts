import { PrismaClient, RoleName } from "@prisma/client";
import { PLANS, PLAN_ORDER } from "../src/lib/billing/plans";
import { AVAILABLE_MODELS } from "../src/config/models";

const prisma = new PrismaClient();

/**
 * Seed the database with:
 *   1. Plans (Free, Starter, Pro, Enterprise)
 *   2. Model configs (every model in AVAILABLE_MODELS)
 *   3. Permissions + role-permission mappings (DEFAULT_PERMISSIONS)
 *   4. A demo organization + user (for local dev)
 *
 * Run: pnpm db:seed
 */
async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. Plans ──────────────────────────────────────────────
  console.log("  → Plans...");
  for (const slug of PLAN_ORDER) {
    const plan = PLANS[slug];
    await prisma.plan.upsert({
      where: { slug },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        tokenQuota: plan.tokenQuota,
        seatQuota: plan.seatQuota,
        storageQuotaMb: plan.storageQuotaMb,
        features: plan.features,
        isActive: true,
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        tokenQuota: plan.tokenQuota,
        seatQuota: plan.seatQuota,
        storageQuotaMb: plan.storageQuotaMb,
        features: plan.features,
        isActive: true,
      },
    });
  }

  // ── 2. Model configs ──────────────────────────────────────
  console.log("  → Model configs...");
  for (const model of AVAILABLE_MODELS) {
    await prisma.modelConfig.upsert({
      where: { provider_modelName: { provider: model.provider, modelName: model.modelName } },
      update: {
        displayName: model.displayName,
        contextWindow: model.contextWindow,
        inputCostPer1K: model.inputCostPer1K,
        outputCostPer1K: model.outputCostPer1K,
        capabilities: model.capabilities,
      },
      create: {
        provider: model.provider,
        modelName: model.modelName,
        displayName: model.displayName,
        contextWindow: model.contextWindow,
        inputCostPer1K: model.inputCostPer1K,
        outputCostPer1K: model.outputCostPer1K,
        capabilities: model.capabilities,
      },
    });
  }

  // ── 3. Permissions + role mappings ────────────────────────
  console.log("  → Permissions...");
  const allPermissions = new Set<string>();
  Object.values(RoleName).forEach((role) => {
    const perms = DEFAULT_PERMISSIONS_SEED[role];
    perms.forEach((p) => {
      if (!p.endsWith(":*") && p !== "*") allPermissions.add(p);
    });
  });
  // Add domain wildcards too
  ["agents", "conversations", "knowledge_base", "members", "billing", "api_keys", "webhooks", "audit_log", "usage", "compliance"].forEach(
    (domain) => allPermissions.add(`${domain}:*`)
  );

  for (const action of allPermissions) {
    await prisma.permission.upsert({
      where: { action },
      update: {},
      create: { action },
    });
  }

  // Map roles to permissions
  for (const role of Object.values(RoleName)) {
    const perms = DEFAULT_PERMISSIONS_SEED[role];
    for (const action of perms) {
      if (action === "*") continue; // OWNER bypass — no need to seed
      const perm = await prisma.permission.findUnique({ where: { action } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: perm.id } },
        update: {},
        create: { role, permissionId: perm.id },
      });
    }
  }

  // ── 4. Demo org + user (dev only) ─────────────────────────
  if (process.env.NODE_ENV !== "production") {
    console.log("  → Demo org + user...");
    const demoUser = await prisma.user.upsert({
      where: { email: "demo@example.com" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "demo@example.com",
        name: "Demo User",
      },
    });

    const demoOrg = await prisma.organization.upsert({
      where: { slug: "demo-org" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Demo Organization",
        slug: "demo-org",
        billingEmail: "demo@example.com",
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: demoUser.id,
          organizationId: demoOrg.id,
        },
      },
      update: {},
      create: {
        userId: demoUser.id,
        organizationId: demoOrg.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    // Demo subscription (Pro plan, trialing) so the chat budget check works
    const proPlan = await prisma.plan.findUnique({ where: { slug: "pro" } });
    if (proPlan) {
      await prisma.subscription.upsert({
        where: {
          organizationId_provider: {
            organizationId: demoOrg.id,
            provider: "stripe",
          },
        },
        update: {},
        create: {
          organizationId: demoOrg.id,
          planId: proPlan.id,
          status: "TRIALING",
          provider: "stripe",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });
    }

    // Demo agent
    const freeModel = await prisma.modelConfig.findFirst({
      where: { provider: "google", modelName: "gemini-2.0-flash" },
    });
    if (freeModel) {
      await prisma.agent.upsert({
        where: { id: "00000000-0000-0000-0000-000000000003" },
        update: {},
        create: {
          id: "00000000-0000-0000-0000-000000000003",
          organizationId: demoOrg.id,
          name: "Demo Assistant",
          description: "A demo agent powered by Gemini 2.0 Flash (free tier)",
          systemPrompt: "You are a helpful assistant. Be concise and friendly.",
          modelConfigId: freeModel.id,
          status: "ACTIVE",
        },
      });
    }
  }

  console.log("✅ Seed complete!");
  console.log("");
  console.log("Demo login:");
  console.log("  Email:    demo@example.com");
  console.log("  (Use Supabase Auth to set a password for this user)");
}

const DEFAULT_PERMISSIONS_SEED: Record<RoleName, string[]> = {
  OWNER: ["*"],
  ADMIN: [
    "agents:*",
    "conversations:*",
    "knowledge_base:*",
    "members:*",
    "billing:read",
    "api_keys:*",
    "webhooks:*",
    "audit_log:read",
    "usage:read",
    "compliance:*",
  ],
  MEMBER: [
    "agents:read",
    "agents:create",
    "agents:update",
    "conversations:read",
    "conversations:create",
    "knowledge_base:read",
    "knowledge_base:upload",
    "usage:read",
    "api_keys:read",
    "api_keys:create",
  ],
  VIEWER: [
    "agents:read",
    "conversations:read",
    "knowledge_base:read",
    "usage:read",
    "audit_log:read",
  ],
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
