"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/logger";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const createWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.string().min(1, "At least one event is required"),
});

export async function createWebhookAction(prevState: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const session = await requireUser();
    const orgId = await requireActiveOrgId();

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership || !can(membership.role, "webhooks:create")) {
      return { error: "You do not have permission to create webhooks" };
    }

    const input = createWebhookSchema.parse({
      url: formData.get("url"),
      events: formData.get("events"),
    });

    const events = input.events.split(",").map((e) => e.trim()).filter(Boolean);
    const secret = `whsec_${randomBytes(24).toString("hex")}`;

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        url: input.url,
        events,
        secret,
        isActive: true,
      },
    });

    await audit({
      organizationId: orgId,
      userId: session.user.id,
      action: "CREATE",
      resourceType: "webhook_endpoint",
      resourceId: endpoint.id,
      metadata: { url: input.url, events },
    });

    revalidatePath("/dashboard/settings/webhooks");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create webhook" };
  }
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const orgId = await requireActiveOrgId();
  const endpointId = formData.get("id") as string;

  await prisma.webhookEndpoint.delete({
    where: { id: endpointId, organizationId: orgId },
  });

  await audit({
    organizationId: orgId,
    userId: session.user.id,
    action: "DELETE",
    resourceType: "webhook_endpoint",
    resourceId: endpointId,
  });

  revalidatePath("/dashboard/settings/webhooks");
}
