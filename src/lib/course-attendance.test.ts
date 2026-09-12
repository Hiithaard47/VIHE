import { describe, expect, it } from "vitest";
import { emptyTally } from "@/lib/attendance";
import { recordInTallies, tallyFor } from "@/lib/course-attendance";

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
