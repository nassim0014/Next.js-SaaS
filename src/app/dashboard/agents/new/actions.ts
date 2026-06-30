"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/logger";
import { createAgentSchema } from "@/lib/validators/agent";

export async function createAgentAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const orgId = await requireActiveOrgId();

  // RBAC check — only ADMIN+ can create agents
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
  });
  if (!membership || !can(membership.role, "agents:create")) {
    throw new Error("FORBIDDEN: you do not have permission to create agents");
  }

  // Parse + validate input
  const raw = {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    systemPrompt: formData.get("systemPrompt") || undefined,
    modelConfigId: formData.get("modelConfigId"),
    temperature: parseFloat(formData.get("temperature") as string),
    maxTokens: parseInt(formData.get("maxTokens") as string, 10),
  };
  const input = createAgentSchema.parse(raw);

  // Verify the model config exists
  const modelConfig = await prisma.modelConfig.findUnique({
    where: { id: input.modelConfigId },
  });
  if (!modelConfig) {
    throw new Error("Model configuration not found");
  }

  // Create the agent
  const agent = await prisma.agent.create({
    data: {
      organizationId: orgId,
      name: input.name,
      description: input.description,
      systemPrompt: input.systemPrompt,
      modelConfigId: input.modelConfigId,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      status: "ACTIVE",
    },
  });

  // Audit log
  await audit({
    organizationId: orgId,
    userId: session.user.id,
    action: "CREATE",
    resourceType: "agent",
    resourceId: agent.id,
    metadata: { name: agent.name, modelConfigId: agent.modelConfigId },
  });

  revalidatePath("/dashboard/agents");
  redirect("/dashboard/agents");
}
