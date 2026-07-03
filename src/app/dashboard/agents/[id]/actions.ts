"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/logger";
import { updateAgentSchema } from "@/lib/validators/agent";

export async function updateAgentAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const orgId = await requireActiveOrgId();

  // RBAC check — only ADMIN+ can edit agents
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
  });
  if (!membership || !can(membership.role, "agents:update")) {
    throw new Error("FORBIDDEN: you do not have permission to edit agents");
  }

  const agentId = formData.get("agentId");
  if (typeof agentId !== "string") {
    throw new Error("Agent id is required");
  }

  // Parse + validate input (updateAgentSchema is `.partial()` on createAgentSchema)
  const raw = {
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    systemPrompt: formData.get("systemPrompt") || undefined,
    modelConfigId: formData.get("modelConfigId") || undefined,
    temperature: formData.get("temperature") !== null ? parseFloat(formData.get("temperature") as string) : undefined,
    maxTokens: formData.get("maxTokens") !== null ? parseInt(formData.get("maxTokens") as string, 10) : undefined,
  };
  const input = updateAgentSchema.parse(raw);

  // Verify the agent belongs to this org before updating
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId: orgId },
  });
  if (!agent) {
    throw new Error("Agent not found");
  }

  // If a model config is supplied, verify it exists
  if (input.modelConfigId) {
    const modelConfig = await prisma.modelConfig.findUnique({
      where: { id: input.modelConfigId },
    });
    if (!modelConfig) {
      throw new Error("Model configuration not found");
    }
  }

  // Update the agent
  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
      ...(input.modelConfigId !== undefined && { modelConfigId: input.modelConfigId }),
      ...(input.temperature !== undefined && { temperature: input.temperature }),
      ...(input.maxTokens !== undefined && { maxTokens: input.maxTokens }),
    },
  });

  // Audit log
  await audit({
    organizationId: orgId,
    userId: session.user.id,
    action: "UPDATE",
    resourceType: "agent",
    resourceId: updated.id,
    metadata: { name: updated.name, modelConfigId: updated.modelConfigId },
  });

  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${agentId}`);
  redirect(`/dashboard/agents/${agentId}`);
}
