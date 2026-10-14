import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const findManyMock: Mock = vi.fn();
const createMock: Mock = vi.fn();
const updateMock: Mock = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEndpoint: { findMany: (...a: unknown[]) => findManyMock(...a) },
    webhookEvent: {
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

const signWebhookMock: Mock = vi.fn().mockReturnValue("test-signature");
vi.mock("@/lib/webhooks/signer", () => ({
  signWebhook: (...a: unknown[]) => signWebhookMock(...a),
}));

const scheduleRetryMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webhooks/retry", () => ({
  scheduleRetry: (...a: unknown[]) => scheduleRetryMock(...a),
}));

const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");

function endpoint(id: string, url = "https://receiver.test/hook") {
  return {
    id,
    url,
    secret: "endpoint-secret",
    organizationId: "org-1",
    isActive: true,
    events: ["conversation.created"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  createMock.mockResolvedValue({ id: "evt-created" });
});

describe("webhooks/dispatcher - dispatchWebhookEvent", () => {
  it("looks up only active endpoints subscribed to this event on this org", async () => {
    findManyMock.mockResolvedValue([]);

    await dispatchWebhookEvent("org-1", "conversation.created", { foo: "bar" });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        isActive: true,
        events: { has: "conversation.created" },
      },
    });
  });

  it("does nothing further when no endpoint is subscribed", async () => {
    findManyMock.mockResolvedValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await dispatchWebhookEvent("org-1", "conversation.created", {});

    expect(createMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records a DELIVERED WebhookEvent and does not schedule a retry on a 2xx response", async () => {
    findManyMock.mockResolvedValue([endpoint("ep-1")]);
    createMock.mockResolvedValue({ id: "evt-1" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await dispatchWebhookEvent("org-1", "conversation.created", { id: "c1" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endpointId: "ep-1",
          eventType: "conversation.created",
          status: "PENDING",
        }),
      })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({ status: "DELIVERED", responseCode: 200 }),
      })
    );
    expect(scheduleRetryMock).not.toHaveBeenCalled();
  });

  it("marks FAILED and schedules a retry on a non-2xx response", async () => {
    findManyMock.mockResolvedValue([endpoint("ep-1")]);
    createMock.mockResolvedValue({ id: "evt-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch
    );

    await dispatchWebhookEvent("org-1", "conversation.created", {});

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({
          status: "FAILED",
          responseCode: 503,
          attempts: { increment: 1 },
        }),
      })
    );
    expect(scheduleRetryMock).toHaveBeenCalledWith("evt-1");
  });

  it("marks FAILED and schedules a retry when the request throws (network error / timeout)", async () => {
    findManyMock.mockResolvedValue([endpoint("ep-1")]);
    createMock.mockResolvedValue({ id: "evt-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) as unknown as typeof fetch
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await dispatchWebhookEvent("org-1", "conversation.created", {});

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({ status: "FAILED", attempts: { increment: 1 } }),
      })
    );
    expect(scheduleRetryMock).toHaveBeenCalledWith("evt-1");
    consoleErrorSpy.mockRestore();
  });

  it("signs the body once and sends it with the event-type and signature headers", async () => {
    findManyMock.mockResolvedValue([endpoint("ep-1")]);
    createMock.mockResolvedValue({ id: "evt-1" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await dispatchWebhookEvent("org-1", "conversation.created", { id: "c1" });

    expect(signWebhookMock).toHaveBeenCalledWith(
      expect.stringContaining('"event":"conversation.created"'),
      "endpoint-secret"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://receiver.test/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Webhook-Event": "conversation.created",
          "X-Webhook-Signature": "test-signature",
        }),
      })
    );
  });

  it("dispatches to every subscribed endpoint independently - one failure does not block another's delivery", async () => {
    findManyMock.mockResolvedValue([
      endpoint("ep-ok"),
      endpoint("ep-down", "https://down.test/hook"),
    ]);
    createMock.mockResolvedValueOnce({ id: "evt-ok" }).mockResolvedValueOnce({ id: "evt-down" });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("down.test")) return Promise.reject(new Error("ECONNREFUSED"));
      return Promise.resolve({ ok: true, status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await dispatchWebhookEvent("org-1", "conversation.created", {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-ok" },
        data: expect.objectContaining({ status: "DELIVERED" }),
      })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-down" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    expect(scheduleRetryMock).toHaveBeenCalledWith("evt-down");
    expect(scheduleRetryMock).not.toHaveBeenCalledWith("evt-ok");
  });
});
