"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { exportUserData } from "@/lib/gdpr/export";
import { deleteUserData } from "@/lib/gdpr/deletion";

export type ExportState = { error?: string; downloadUrl?: string; expiresAt?: string };
export type DeletionState = { error?: string; deleted?: boolean };

/**
 * "Request Export" — GDPR right to access.
 * Wires the compliance page's Export button to the already-implemented
 * exportUserData() (produces a ZIP, see lib/gdpr/export.ts).
 */
export async function requestExportAction(
  _prevState: ExportState,
  _formData: FormData
): Promise<ExportState> {
  try {
    const session = await requireUser();
    const orgId = await requireActiveOrgId();
    const { downloadUrl, expiresAt } = await exportUserData(session.user.id, orgId);
    revalidatePath("/dashboard/settings/compliance");
    return { downloadUrl, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to export your data" };
  }
}

/**
 * "Request Deletion" — GDPR right to erasure.
 * Wires the compliance page's Delete button to the already-implemented
 * deleteUserData(). The client component gates this behind a confirmation
 * prompt before ever submitting — this action assumes that already happened.
 */
export async function requestDeletionAction(
  _prevState: DeletionState,
  _formData: FormData
): Promise<DeletionState> {
  try {
    const session = await requireUser();
    const orgId = await requireActiveOrgId();
    await deleteUserData(session.user.id, orgId);
    return { deleted: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete your account" };
  }
}
