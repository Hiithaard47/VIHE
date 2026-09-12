import { describe, it, expect } from "vitest";
import { startOfTodayUtc } from "@/lib/time";

describe("startOfTodayUtc", () => {
  it("returns the local calendar date at UTC midnight", () => {
    const result = startOfTodayUtc(new Date(2026, 8, 12, 23, 30));
    expect(result.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("uses the local date even when UTC has already rolled over", () => {
    const result = startOfTodayUtc(new Date(2026, 0, 1, 0, 15));
    expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
