"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/logger";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";

const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export async function createApiKeyAction(prevState: { key?: string; error?: string }, formData: FormData): Promise<{ key?: string; error?: string }> {
  try {
    const session = await requireUser();
    const orgId = await requireActiveOrgId();

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership || !can(membership.role, "api_keys:create")) {
      return { error: "You do not have permission to create API keys" };
    }

    const input = createApiKeySchema.parse({ name: formData.get("name") });

    // Generate a random API key: nks_live_<48 random chars>
    const rawKey = `nks_live_${randomBytes(24).toString("hex")}`;
    const prefix = rawKey.slice(0, 16);
    const hashedKey = await argon2.hash(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        name: input.name,
        hashedKey,
        prefix,
        status: "ACTIVE",
      },
    });

    await audit({
      organizationId: orgId,
      userId: session.user.id,
      action: "CREATE",
      resourceType: "api_key",
      resourceId: apiKey.id,
      metadata: { name: input.name },
    });

    revalidatePath("/dashboard/settings/api-keys");
    return { key: rawKey };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create API key" };
  }
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const orgId = await requireActiveOrgId();
  const keyId = formData.get("id") as string;

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
  });
  if (!membership || !can(membership.role, "api_keys:create")) {
    throw new Error("You do not have permission to revoke API keys");
  }

  await prisma.apiKey.update({
    where: { id: keyId, organizationId: orgId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  await audit({
    organizationId: orgId,
    userId: session.user.id,
    action: "UPDATE",
    resourceType: "api_key",
    resourceId: keyId,
    metadata: { action: "revoked" },
  });

  revalidatePath("/dashboard/settings/api-keys");
}
