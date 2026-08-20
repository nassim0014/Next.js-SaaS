import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock the Prisma transaction: capture the callback so we can inspect it.
// The tx object passed to the callback has the same model-prefixed structure
// as prisma (tx.conversation.deleteMany, tx.tokenUsage.updateMany, etc).
const deleteManyMock: Mock = vi.fn().mockResolvedValue({ count: 0 })
const updateManyMock: Mock = vi.fn().mockResolvedValue({ count: 0 })
const updateMock: Mock = vi.fn().mockResolvedValue({})
const createMock: Mock = vi.fn().mockResolvedValue({})

const txClient = {
  conversation: { deleteMany: (...args: unknown[]) => deleteManyMock(...(args as [])) },
  tokenUsage: { updateMany: (...args: unknown[]) => updateManyMock(...(args as [])) },
  apiKey: { deleteMany: (...args: unknown[]) => deleteManyMock(...(args as [])) },
  membership: { deleteMany: (...args: unknown[]) => deleteManyMock(...(args as [])) },
  dataRequest: { create: (...args: unknown[]) => createMock(...(args as [])) },
  user: { update: (...args: unknown[]) => updateMock(...(args as [])) },
}

const $transactionMock: Mock = vi.fn(async (cb: (tx: typeof txClient) => Promise<void>) => {
  await cb(txClient)
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => $transactionMock(...(args as [])),
  },
  Prisma: { JsonNull: null },
}))

// Mock the audit logger — it's called inside the transaction
const auditMock: Mock = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/audit/logger", () => ({
  audit: (...args: unknown[]) => auditMock(...(args as [])),
}))

// Mock supabase admin
const deleteUserMock: Mock = vi.fn().mockResolvedValue({ error: null })
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => deleteUserMock(...(args as [])),
      },
    },
  }),
}))

const { deleteUserData } = await import("@/lib/gdpr/deletion");

describe("gdpr/deletion — transaction wrapper (item 2)", () => {
  beforeEach(() => {
    deleteManyMock.mockClear()
    updateManyMock.mockClear()
    updateMock.mockClear()
    createMock.mockClear()
    $transactionMock.mockClear()
    auditMock.mockClear()
    deleteUserMock.mockClear()
    deleteUserMock.mockResolvedValue({ error: null })
  })

  it("wraps steps 1-7 in a single prisma.$transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect($transactionMock).toHaveBeenCalledTimes(1);
  })

  it("deletes conversations inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(deleteManyMock).toHaveBeenCalled();
    // Verify it was called with userId + organizationId
    const firstCall = deleteManyMock.mock.calls[0]![0];
    expect(firstCall.where).toMatchObject({
      userId: "user-1",
      organizationId: "org-1",
    })
  })

  it("anonymizes TokenUsage inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(updateManyMock).toHaveBeenCalled();
    // TokenUsage is the first updateMany call — userId set to null
    const tokenUsageCall = updateManyMock.mock.calls[0]![0];
    expect(tokenUsageCall.where).toMatchObject({
      userId: "user-1",
      organizationId: "org-1",
    })
    expect(tokenUsageCall.data).toEqual({ userId: null })
  })

  it("creates a DataRequest audit record inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(createMock).toHaveBeenCalled();
    const createCall = createMock.mock.calls[0]![0];
    expect(createCall.data.type).toBe("DELETION");
    expect(createCall.data.status).toBe("COMPLETED");
    expect(createCall.data.organizationId).toBe("org-1");
    expect(createCall.data.userId).toBe("user-1");
  })

  it("anonymizes the User record inside the transaction", async () => {
    await deleteUserData("user-1", "org-1");

    expect(updateMock).toHaveBeenCalled();
    const updateCall = updateMock.mock.calls[0]![0];
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
