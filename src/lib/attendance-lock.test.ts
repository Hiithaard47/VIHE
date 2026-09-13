import { describe, expect, it } from "vitest";
import { isAttendanceLocked } from "@/lib/attendance-lock";

describe("isAttendanceLocked", () => {
  const today = new Date("2026-09-13T00:00:00.000Z");

  it("never locks when lockAfterDays is null", () => {
    expect(isAttendanceLocked(new Date("2026-01-01T00:00:00.000Z"), null, today)).toBe(false);
  });

  it("keeps the session day itself open when lockAfterDays is 0", () => {
    expect(isAttendanceLocked(today, 0, today)).toBe(false);
    expect(isAttendanceLocked(new Date("2026-09-12T00:00:00.000Z"), 0, today)).toBe(true);
  });

  it("locks after the configured number of days", () => {
    expect(isAttendanceLocked(new Date("2026-09-06T00:00:00.000Z"), 7, today)).toBe(false);
    expect(isAttendanceLocked(new Date("2026-09-05T00:00:00.000Z"), 7, today)).toBe(true);
  });
});
