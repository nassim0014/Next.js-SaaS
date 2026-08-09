import { describe, it, expect } from "vitest";
import { startOfMonth, endOfMonth } from "@/lib/ai/cost";

describe("ai/cost period-fallback math", () => {
  it("startOfMonth returns midnight on the 1st of the given month", () => {
    const result = startOfMonth(new Date(2026, 6, 15, 13, 45, 30)); // July 15, 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6); // July (0-indexed)
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("endOfMonth returns 23:59:59.999 on the last day of the given month", () => {
    const result = endOfMonth(new Date(2026, 1, 10)); // Feb 2026 (not a leap year)
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });

  it("endOfMonth correctly handles a leap year February", () => {
    const result = endOfMonth(new Date(2028, 1, 1)); // Feb 2028 is a leap year
    expect(result.getDate()).toBe(29);
  });

  it("endOfMonth correctly rolls over a December billing period", () => {
    const result = endOfMonth(new Date(2026, 11, 5)); // December 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(31);
  });

  it("startOfMonth of any day in the month always precedes endOfMonth of the same month", () => {
    const anyDay = new Date(2026, 3, 22); // April 22, 2026
    expect(startOfMonth(anyDay).getTime()).toBeLessThan(endOfMonth(anyDay).getTime());
  });
});
