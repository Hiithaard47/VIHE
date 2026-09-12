import { describe, it, expect } from "vitest";
import { formatDisplayDate, isFutureSessionDate, parseDateInput, startOfTodayUtc, toDateInputValue } from "@/lib/time";

// TZ is pinned to America/New_York in vitest.config.mts. This ensures the tests
// remain hermetic and discriminate between local and UTC getters, catching a
// broken implementation that uses getUTCDate instead of getDate.
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

describe("isFutureSessionDate", () => {
  const now = new Date(2026, 8, 12, 15, 0);

  it("treats tomorrow as future and today as not", () => {
    expect(isFutureSessionDate(new Date("2026-09-13T00:00:00.000Z"), now)).toBe(true);
    expect(isFutureSessionDate(new Date("2026-09-12T00:00:00.000Z"), now)).toBe(false);
    expect(isFutureSessionDate(new Date("2026-09-11T00:00:00.000Z"), now)).toBe(false);
  });

  it("ignores the time of day on the session", () => {
    expect(isFutureSessionDate(new Date("2026-09-12T23:00:00.000Z"), now)).toBe(false);
  });
});

describe("parseDateInput / toDateInputValue", () => {
  it("round-trips a valid calendar date", () => {
    const parsed = parseDateInput("2026-11-20");
    expect(parsed?.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(toDateInputValue(parsed!)).toBe("2026-11-20");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDateInput("2026-02-31")).toBeNull();
    expect(parseDateInput("11-20-2026")).toBeNull();
  });
});

describe("formatDisplayDate", () => {
  it("renders day month year without a leading zero", () => {
    expect(formatDisplayDate(new Date("2026-09-12T00:00:00.000Z"))).toBe("12 Sept 2026");
    expect(formatDisplayDate(new Date("2026-12-01T00:00:00.000Z"))).toBe("1 Dec 2026");
  });
});
