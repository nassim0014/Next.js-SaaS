import { describe, it, expect } from "vitest";
import { signWebhook, verifySignature } from "@/lib/webhooks/signer";

describe("webhooks/signer", () => {
  const secret = "test-signing-secret-abc123"; // gitleaks:allow — test fixture, not a real secret

  it("a signature verifies against the exact payload + secret it was made with", () => {
    const payload = JSON.stringify({ event: "usage.budget_threshold", payload: { percent: 85 } });
    const signature = signWebhook(payload, secret);
    expect(verifySignature(payload, signature, secret)).toBe(true);
  });

  it("rejects a signature computed with a different secret", () => {
    const payload = "hello world";
    const signature = signWebhook(payload, "secret-a");
    expect(verifySignature(payload, signature, "secret-b")).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const payload = "hello world";
    const signature = signWebhook(payload, secret);
    expect(verifySignature("hello world!", signature, secret)).toBe(false);
  });

  it("rejects a wrong-length signature without throwing", () => {
    const payload = "hello world";
    // crypto.timingSafeEqual() throws on mismatched buffer lengths — the
    // length guard in verifySignature() must catch this before that call.
    expect(() => verifySignature(payload, "too-short", secret)).not.toThrow();
    expect(verifySignature(payload, "too-short", secret)).toBe(false);
  });

  it("is deterministic — same payload + secret always produces the same signature", () => {
    const payload = "repeatable payload";
    expect(signWebhook(payload, secret)).toBe(signWebhook(payload, secret));
  });
});
