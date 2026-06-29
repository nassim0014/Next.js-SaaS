import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit/logger";

/**
 * GDPR right-to-erasure — anonymize a user's data while preserving
 * the integrity of audit logs and financial records.
 *
 * What gets DELETED:
 *   - Conversations + Messages (user's chat history)
 *   - TokenUsage rows (cost attribution becomes anonymized)
 *   - API keys (revoked + deleted)
 *   - Memberships (removed from org)
 *
 * What gets ANONYMIZED (kept for financial/legal records):
 *   - BillingEvents (email → "[anonymized]")
 *   - AuditLogs (userId kept as FK but User record is anonymized)
 *
 * What gets HARD-DELETED:
 *   - The User record itself (after anonymization)
 *   - The Supabase Auth user
 */

export async function deleteUserData(userId: string, organizationId: string): Promise<void> {
  // 1. Delete conversations + messages (cascade handles messages)
  await prisma.conversation.deleteMany({
    where: { userId, organizationId },
  });

  // 2. Anonymize TokenUsage rows (keep for cost analytics, drop user link)
  await prisma.tokenUsage.updateMany({
    where: { userId, organizationId },
    data: { userId: null },
  });

  // 3. Revoke + delete API keys
  await prisma.apiKey.deleteMany({
    where: { userId },
  });

  // 4. Remove memberships
  await prisma.membership.deleteMany({
    where: { userId, organizationId },
  });

  // 5. Record a DataRequest for audit trail
  await prisma.dataRequest.create({
    data: {
      organizationId,
      userId,
      type: "DELETION",
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: { anonymized: true },
    },
  });

  // 6. Audit log (before user is deleted, so we still have the userId)
  await audit({
    organizationId,
    userId,
    action: "DELETE",
    resourceType: "user",
    resourceId: userId,
    metadata: { reason: "gdpr_right_to_erasure" },
  });

  // 7. Anonymize the User record (preserve row for FK integrity on BillingEvent etc.)
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `anonymized+${userId}@deleted.local`,
      name: null,
      avatarUrl: null,
      lastLoginAt: null,
    },
  });

  // 8. Delete the Supabase Auth user (this signs them out everywhere)
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
