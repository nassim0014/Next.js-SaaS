import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit/logger";

/**
 * GDPR data export — assemble all of a user's data into a ZIP file
 * and upload it to Supabase Storage. Returns a signed URL valid for 7 days.
 *
 * Triggered by the user from /settings/compliance ("Download my data").
 */

export async function exportUserData(userId: string, organizationId: string): Promise<{
  downloadUrl: string;
  expiresAt: Date;
}> {
  // 1. Collect all user data from every table where user has rows
  const [user, memberships, conversations, messages, tokenUsage, auditLogs, apiKeys, dataRequests] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.membership.findMany({ where: { userId } }),
      prisma.conversation.findMany({ where: { userId, organizationId } }),
      prisma.message.findMany({
        where: { conversation: { userId, organizationId } },
        include: { conversation: true },
      }),
      prisma.tokenUsage.findMany({ where: { userId, organizationId } }),
      prisma.auditLog.findMany({ where: { userId, organizationId } }),
      prisma.apiKey.findMany({ where: { userId } }),
      prisma.dataRequest.findMany({ where: { userId, organizationId } }),
    ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    memberships,
    conversations,
    messages,
    tokenUsage,
    auditLogs,
    apiKeys: apiKeys.map((k) => ({ ...k, hashedKey: "[REDACTED]" })),
    dataRequests,
  };

  // 2. Build a JSON payload (in production, ZIP this with multiple files)
  const json = JSON.stringify(exportData, null, 2);
  const buffer = Buffer.from(json, "utf-8");

  // 3. Upload to Supabase Storage
  const admin = supabaseAdmin();
  const path = `gdpr-exports/${organizationId}/${userId}-${Date.now()}.json`;

  const { error: uploadError } = await admin.storage
    .from("uploads")
    .upload(path, buffer, { contentType: "application/json", upsert: false });

  if (uploadError) throw uploadError;

  // 4. Generate a signed URL valid for 7 days
  const { data: signedUrlData, error: urlError } = await admin.storage
    .from("uploads")
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (urlError || !signedUrlData) throw urlError;

  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000);

  // 5. Record a DataRequest row for audit trail
  await prisma.dataRequest.create({
    data: {
      organizationId,
      userId,
      type: "EXPORT",
      status: "COMPLETED",
      downloadUrl: signedUrlData.signedUrl,
      downloadExpiresAt: expiresAt,
      completedAt: new Date(),
    },
  });

  // 6. Audit log
  await audit({
    organizationId,
    userId,
    action: "EXPORT",
    resourceType: "user_data",
    resourceId: userId,
    metadata: { format: "json", sizeBytes: buffer.length },
  });

  return { downloadUrl: signedUrlData.signedUrl, expiresAt };
}
