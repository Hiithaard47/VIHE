import { describe, it, expect } from "vitest";
import {
  attendancePercent,
  countsAsAttended,
  emptyTally,
  isAtRisk,
  statusLetter,
  type AttendancePolicy,
  type StatusTally,
} from "@/lib/attendance";

const strict: AttendancePolicy = {
  minAttendancePercent: 75,
  lateCountsAsAttended: false,
  excusedCountsAsAttended: false,
};
const lenient: AttendancePolicy = {
  minAttendancePercent: 75,
  lateCountsAsAttended: true,
  excusedCountsAsAttended: true,
};

function tally(partial: Partial<StatusTally>): StatusTally {
  return { ...emptyTally(), ...partial };
}

describe("countsAsAttended", () => {
  it("always counts PRESENT and never counts ABSENT, whatever the policy", () => {
    expect(countsAsAttended("PRESENT", strict)).toBe(true);
    expect(countsAsAttended("ABSENT", lenient)).toBe(false);
  });

  it("defers to the policy for LATE and EXCUSED", () => {
    expect(countsAsAttended("LATE", strict)).toBe(false);
    expect(countsAsAttended("LATE", lenient)).toBe(true);
    expect(countsAsAttended("EXCUSED", strict)).toBe(false);
    expect(countsAsAttended("EXCUSED", lenient)).toBe(true);
  });
});

describe("attendancePercent", () => {
  it("returns null when nothing has been marked, not 0", () => {
    expect(attendancePercent(emptyTally(), lenient)).toBeNull();
  });

  it("counts late and excused when the policy says so", () => {
    const t = tally({ PRESENT: 6, LATE: 1, EXCUSED: 1, ABSENT: 2 });
    expect(attendancePercent(t, lenient)).toBe(80);
    expect(attendancePercent(t, strict)).toBe(60);
  });

  it("rounds to the nearest whole percent", () => {
    expect(attendancePercent(tally({ PRESENT: 1, ABSENT: 2 }), lenient)).toBe(33);
  });
});

describe("isAtRisk", () => {
  it("is false for a student sitting exactly at the threshold", () => {
    expect(isAtRisk(75, lenient)).toBe(false);
  });

  it("is true strictly below the threshold", () => {
    expect(isAtRisk(74, lenient)).toBe(true);
  });

  it("is false when the course sets no threshold", () => {
    expect(isAtRisk(10, { ...lenient, minAttendancePercent: null })).toBe(false);
  });

  it("is false when there is no percentage to judge", () => {
    expect(isAtRisk(null, lenient)).toBe(false);
  });
});

describe("statusLetter", () => {
  it("maps each status to its first letter and blanks to an em dash", () => {
    expect(statusLetter("PRESENT")).toBe("P");
    expect(statusLetter("ABSENT")).toBe("A");
    expect(statusLetter("LATE")).toBe("L");
    expect(statusLetter("EXCUSED")).toBe("E");
    expect(statusLetter(null)).toBe("—");
    expect(statusLetter(undefined)).toBe("—");
  });
});
