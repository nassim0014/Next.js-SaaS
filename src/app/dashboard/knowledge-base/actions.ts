"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/logger";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export async function createKnowledgeBaseAction(prevState: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const session = await requireUser();
    const orgId = await requireActiveOrgId();

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership || !can(membership.role, "knowledge_base:upload")) {
      return { error: "You do not have permission to create knowledge bases" };
    }

    const input = createKnowledgeBaseSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    });

    const kb = await prisma.knowledgeBase.create({
      data: {
        organizationId: orgId,
        name: input.name,
        description: input.description,
      },
    });

    await audit({
      organizationId: orgId,
      userId: session.user.id,
      action: "CREATE",
      resourceType: "knowledge_base",
      resourceId: kb.id,
      metadata: { name: input.name },
    });

    revalidatePath("/dashboard/knowledge-base");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create knowledge base" };
  }
}
