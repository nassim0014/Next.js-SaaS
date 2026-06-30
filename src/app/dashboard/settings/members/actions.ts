"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/logger";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const inviteMemberSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function inviteMemberAction(prevState: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const session = await requireUser();
    const orgId = await requireActiveOrgId();

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership || !can(membership.role, "members:invite")) {
      return { error: "You do not have permission to invite members" };
    }

    const input = inviteMemberSchema.parse({
      email: formData.get("email"),
      role: formData.get("role") || "MEMBER",
    });

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (existingMembership) {
        return { error: "User is already a member of this organization" };
      }
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: { email: input.email, organizationId: orgId, acceptedAt: null },
    });
    if (existingInvite) {
      return { error: "An invitation is already pending for this email" };
    }

    const invitation = await prisma.invitation.create({
      data: {
        email: input.email,
        organizationId: orgId,
        role: input.role,
        token: randomBytes(32).toString("hex"),
        invitedById: session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    await audit({
      organizationId: orgId,
      userId: session.user.id,
      action: "INVITE",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { email: input.email, role: input.role },
    });

    revalidatePath("/dashboard/settings/members");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send invitation" };
  }
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const orgId = await requireActiveOrgId();
  const membershipId = formData.get("id") as string;

  const targetMembership = await prisma.membership.findUnique({
    where: { id: membershipId },
  });

  if (!targetMembership || targetMembership.organizationId !== orgId) {
    throw new Error("Member not found");
  }

  if (targetMembership.role === "OWNER") {
    throw new Error("Cannot remove the organization owner");
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  await audit({
    organizationId: orgId,
    userId: session.user.id,
    action: "DELETE",
    resourceType: "membership",
    resourceId: membershipId,
  });

  revalidatePath("/dashboard/settings/members");
}
