import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// The bug this file regresses: createWebhookAction generates and persists a
// `whsec_...` signing secret, but on `main` it returns `{}` on success — the
// secret is never handed back to the caller, so a customer receiving signed
// webhook deliveries has no way to obtain the secret needed to verify them.

const findUniqueMock: Mock = vi.fn();
const createMock: Mock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findUnique: (...a: unknown[]) => findUniqueMock(...a) },
    webhookEndpoint: { create: (...a: unknown[]) => createMock(...a) },
  },
}));

const requireUserMock: Mock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

const requireActiveOrgIdMock: Mock = vi.fn();
vi.mock("@/lib/auth/org-context", () => ({
  requireActiveOrgId: () => requireActiveOrgIdMock(),
}));

const canMock: Mock = vi.fn();
vi.mock("@/lib/auth/rbac", () => ({
  can: (...a: unknown[]) => canMock(...a),
}));

const auditMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/logger", () => ({
  audit: (...a: unknown[]) => auditMock(...a),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createWebhookAction } = await import("./actions");

function formDataFor(url: string, events: string): FormData {
  const fd = new FormData();
  fd.set("url", url);
  fd.set("events", events);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  auditMock.mockResolvedValue(undefined);
  requireUserMock.mockResolvedValue({ user: { id: "user-1" } });
  requireActiveOrgIdMock.mockResolvedValue("org-1");
});

describe("createWebhookAction", () => {
  it("returns the created endpoint's signing secret on success", async () => {
    findUniqueMock.mockResolvedValue({ role: "OWNER" });
    canMock.mockReturnValue(true);
    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "endpoint-1",
      ...data,
    }));

    const result = await createWebhookAction({}, formDataFor("https://example.com/hook", "conversation.created"));

    expect(createMock).toHaveBeenCalledTimes(1);
    const persistedSecret = createMock.mock.calls[0]![0].data.secret;

    expect(result.secret).toBe(persistedSecret);
    expect(result.secret?.startsWith("whsec_")).toBe(true);
  });

  it("returns no secret when the user lacks permission", async () => {
    findUniqueMock.mockResolvedValue({ role: "MEMBER" });
    canMock.mockReturnValue(false);

    const result = await createWebhookAction({}, formDataFor("https://example.com/hook", "conversation.created"));

    expect(result.secret).toBeUndefined();
    expect(typeof result.error).toBe("string");
    expect(result.error?.length).toBeGreaterThan(0);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns no secret on a validation error", async () => {
    findUniqueMock.mockResolvedValue({ role: "OWNER" });
    canMock.mockReturnValue(true);

    const result = await createWebhookAction({}, formDataFor("not-a-valid-url", "conversation.created"));

    expect(result.secret).toBeUndefined();
    expect(typeof result.error).toBe("string");
    expect(result.error?.length).toBeGreaterThan(0);
    expect(createMock).not.toHaveBeenCalled();
  });
});

// Base-commit pin: proves this is a real behavioral regression, not just a
// new assertion that happens to pass either way. Resolves against the fixed
// commit immediately before this fix (PIN_COMMIT below), NOT the `main`
// branch name — `main` moves, and once this fix merged, a CI run triggered
// by that very push checks out a local `main` ref that IS the new HEAD, so
// resolving "main" at test time compared the fixed code against itself and
// failed on every subsequent push to main (observed in CI from 2026-09-07
// onward). A fixed SHA can't drift out from under itself that way. It's
// read via `execFile` (never a shell string) and skips cleanly (not error)
// if that commit isn't reachable, so it degrades gracefully on a shallow CI
// checkout instead of failing red for an infrastructure reason unrelated to
// the code under test — most CI runs take this path, since the default
// `actions/checkout` depth here is 1.
//
// The extracted base-commit source is written verbatim (no re-typing, no
// manual transpile) to a throwaway `.ts` file alongside this test and loaded
// via dynamic import — Vitest/Vite transpiles it and resolves its `@/...`
// imports exactly as it does for `actions.ts` itself, which routes those
// imports to the SAME `vi.mock` doubles registered above (mocks apply by
// resolved module id, not by importing file), so this genuinely executes the
// old implementation against the old code, not a narration of it.
const PIN_COMMIT = "e32585b1e975fce9a34d673e90af0c8003d31e17"; // parent of the #91 fix commit

describe("createWebhookAction — base-commit regression pin", () => {
  it(`commit ${PIN_COMMIT.slice(0, 7)}'s createWebhookAction returns no secret on success (the bug this change fixes)`, async () => {
    const { execFileSync } = await import("node:child_process");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const { pathToFileURL, fileURLToPath } = await import("node:url");
    const thisDir = path.dirname(fileURLToPath(import.meta.url));

    let ref: string | null = null;
    try {
      execFileSync("git", ["rev-parse", "--verify", PIN_COMMIT], { stdio: "ignore" });
      ref = PIN_COMMIT;
    } catch {
      // not reachable — shallow checkout, most likely
    }

    if (!ref) {
      console.warn(`createWebhookAction base-commit pin: skipped, pinned commit ${PIN_COMMIT} not reachable`);
      return;
    }

    let baseSource: string;
    try {
      baseSource = execFileSync("git", ["show", `${ref}:src/app/dashboard/settings/webhooks/actions.ts`], {
        encoding: "utf-8",
      });
    } catch {
      console.warn(`createWebhookAction base-commit pin: skipped, could not read actions.ts from ${ref}`);
      return;
    }

    const tmpFile = path.join(thisDir, `actions.base-pin.generated.ts`);
    fs.writeFileSync(tmpFile, baseSource, "utf-8");

    try {
      findUniqueMock.mockResolvedValue({ role: "OWNER" });
      canMock.mockReturnValue(true);
      createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "endpoint-1",
        ...data,
      }));

      const baseModule = await import(/* @vite-ignore */ pathToFileURL(tmpFile).href);
      const result = await baseModule.createWebhookAction(
        {},
        formDataFor("https://example.com/hook", "conversation.created"),
      );

      expect(createMock).toHaveBeenCalledTimes(1);

      // This is the regression: main's implementation persists a secret
      // (createMock was called with one) but returns `{}`, so the caller
      // never receives it.
      expect(result).toEqual({});
      expect(result.secret).toBeUndefined();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
