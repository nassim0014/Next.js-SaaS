import { describe, it, expect } from "vitest";
import { hasPermission, can } from "@/lib/auth/permissions";

describe("auth/permissions", () => {
  it("OWNER's '*' wildcard matches any action", () => {
    expect(hasPermission("OWNER", "anything:at_all")).toBe(true);
    expect(hasPermission("OWNER", "billing:manage")).toBe(true);
  });

  it("a domain wildcard ('agents:*') matches any action in that domain", () => {
    expect(hasPermission("ADMIN", "agents:create")).toBe(true);
    expect(hasPermission("ADMIN", "agents:archive")).toBe(true);
    expect(hasPermission("ADMIN", "agents:anything")).toBe(true);
  });

  it("wildcarded and individually-granted permissions both work for the same role", () => {
    // ADMIN has "billing:read" AND "billing:manage" granted individually
    // (no "billing:*" wildcard exists) — both must resolve true, and an
    // ungranted billing action must still resolve false.
    expect(hasPermission("ADMIN", "billing:read")).toBe(true);
    expect(hasPermission("ADMIN", "billing:manage")).toBe(true);
    expect(hasPermission("ADMIN", "billing:delete_account")).toBe(false);
  });

  it("a domain wildcard does not leak into a differently-prefixed domain", () => {
    // "agents:*" must not match a domain that merely starts with the same
    // letters (the colon in the "agents:" prefix check is what prevents
    // this — see hasPermission()'s implementation).
    expect(hasPermission("ADMIN", "agents:create")).toBe(true);
    expect(hasPermission("ADMIN", "agentsomething:read")).toBe(false);
  });

  it("MEMBER only has its explicitly listed actions", () => {
    expect(hasPermission("MEMBER", "agents:read")).toBe(true);
    expect(hasPermission("MEMBER", "agents:create")).toBe(true);
    expect(hasPermission("MEMBER", "agents:delete")).toBe(false);
    expect(hasPermission("MEMBER", "billing:manage")).toBe(false);
  });

  it("VIEWER can read but not create or mutate", () => {
    expect(hasPermission("VIEWER", "conversations:read")).toBe(true);
    expect(hasPermission("VIEWER", "conversations:create")).toBe(false);
    expect(hasPermission("VIEWER", "agents:create")).toBe(false);
  });

  it("can() is a direct alias for hasPermission()", () => {
    expect(can("OWNER", "billing:manage")).toBe(hasPermission("OWNER", "billing:manage"));
    expect(can("VIEWER", "agents:create")).toBe(hasPermission("VIEWER", "agents:create"));
  });
});
