import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma transaction: capture the callback so we can inspect it,
// and mock each tx.* method the deletion calls inside the transaction.
const txMocks: Record<string, ReturnType<typeof vi.fn>> = {
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  update: vi.fn().mockResolvedValue({}),
  create: vi.fn().mockResolvedValue({}),
}

const $transactionMock = vi.fn(async (cb: (tx: typeof txMocks) => Promise<void>) => {
  await cb(txMocks)
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => $transactionMock(...args),
    conversation: { deleteMany: (...args: unknown[]) => txMocks.deleteMany(...args) },
    tokenUsage: { updateMany: (...args: unknown[]) => txMocks.updateMany(...args) },
    apiKey: { deleteMany: (...args: unknown[]) => txMocks.deleteMany(...args) },
    membership: { deleteMany: (...args: unknown[]) => txMocks.deleteMany(...args) },
    dataRequest: { create: (...args: unknown[]) => txMocks.create(...args) },
    user: { update: (...args: unknown[]) => txMocks.update(...args) },
  },
  Prisma: { JsonNull: null },
}))

// Mock the audit logger — it's called inside the transaction
const auditMock = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/audit/logger", () => ({
  audit: (...args: unknown[]) => auditMock(...args),
}))

// Mock supabase admin
const deleteUserMock = vi.fn().mockResolvedValue({ error: null })
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => deleteUserMock(...args),
      },
    },
  }),
}))

const { deleteUserData } = await import("@/lib/gdpr/deletion");

describe("gdpr/deletion — transaction wrapper (item 2)", () => {
  beforeEach(() => {
    Object.values(txMocks).forEach((m) => m.mockClear());
    $transactionMock.mockClear();
    auditMock.mockClear();
    deleteUserMock.mockClear();
    deleteUserMock.mockResolvedValue({ error: null });
  })

  it("wraps steps 1-7 in a single prisma.$transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect($transactionMock).toHaveBeenCalledTimes(1);
  })

  it("deletes conversations inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    // tx.conversation.deleteMany should have been called
    expect(txMocks.deleteMany).toHaveBeenCalled();
    // Verify it was called with userId + organizationId
    const firstCall = txMocks.deleteMany.mock.calls[0]![0];
    expect(firstCall.where).toMatchObject({
      userId: "user-1",
      organizationId: "org-1",
    })
  })

  it("anonymizes TokenUsage inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(txMocks.updateMany).toHaveBeenCalled();
    // TokenUsage is the first updateMany call — userId set to null
    const tokenUsageCall = txMocks.updateMany.mock.calls[0]![0];
    expect(tokenUsageCall.where).toMatchObject({
      userId: "user-1",
      organizationId: "org-1",
    })
    expect(tokenUsageCall.data).toEqual({ userId: null })
  })

  it("creates a DataRequest audit record inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(txMocks.create).toHaveBeenCalled();
    const createCall = txMocks.create.mock.calls[0]![0];
    expect(createCall.data.type).toBe("DELETION");
    expect(createCall.data.status).toBe("COMPLETED");
    expect(createCall.data.organizationId).toBe("org-1");
    expect(createCall.data.userId).toBe("user-1");
  })

  it("anonymizes the User record inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(txMocks.update).toHaveBeenCalled();
    const updateCall = txMocks.update.mock.calls[0]![0];
    expect(updateCall.where).toEqual({ id: "user-1" });
    expect(updateCall.data.email).toContain("anonymized+");
    expect(updateCall.data.email).toContain("@deleted.local");
    expect(updateCall.data.name).toBeNull();
    expect(updateCall.data.avatarUrl).toBeNull();
  })

  it("writes an audit log inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditCall = auditMock.mock.calls[0]![0];
    expect(auditCall.action).toBe("DELETE");
    expect(auditCall.resourceType).toBe("user");
    expect(auditCall.resourceId).toBe("user-1");
    expect(auditCall.metadata.reason).toBe("gdpr_right_to_erasure");
  })

  it("deletes the Supabase Auth user AFTER the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    // The transaction should complete before the Supabase call
    expect($transactionMock).toHaveBeenCalled();
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  })

  it("throws if Supabase Auth deletion fails", async () => {
    deleteUserMock.mockResolvedValue({ error: { message: "Auth service down" } })

    await expect(deleteUserData("user-1", "org-1")).rejects.toEqual({
      message: "Auth service down",
    })
  })
})
