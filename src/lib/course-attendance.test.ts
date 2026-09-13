import { describe, expect, it } from "vitest";
import { emptyTally } from "@/lib/attendance";
import { recordInTallies, recordMark, statusAt, tallyFor } from "@/lib/course-attendance";

describe("recordInTallies", () => {
  it("keeps each category's marks on its own book", () => {
    const tallies = new Map();
    recordInTallies(tallies, "stu", "class", "PRESENT");
    recordInTallies(tallies, "stu", "class", "ABSENT");
    recordInTallies(tallies, "stu", "mangala", "PRESENT");

    expect(tallyFor(tallies, "stu", "class")).toEqual({ ...emptyTally(), PRESENT: 1, ABSENT: 1 });
    expect(tallyFor(tallies, "stu", "mangala")).toEqual({ ...emptyTally(), PRESENT: 1 });
    expect(tallyFor(tallies, "stu", "prasad")).toEqual(emptyTally());
  });
});

describe("statusAt", () => {
  it("returns the mark for a student on a session, or null", () => {
    const marks = new Map();
    recordMark(marks, "stu", "s1", "PRESENT");
    recordMark(marks, "stu", "s2", "ABSENT");

    expect(statusAt(marks, "stu", "s1")).toBe("PRESENT");
    expect(statusAt(marks, "stu", "s2")).toBe("ABSENT");
    expect(statusAt(marks, "stu", "s3")).toBeNull();
    expect(statusAt(marks, "other", "s1")).toBeNull();
  });
});
