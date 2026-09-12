import { describe, it, expect } from "vitest";
import { otherBatchEnrollmentWhere } from "@/lib/enrollment";

describe("otherBatchEnrollmentWhere", () => {
  it("targets the same student on sibling batches of the course", () => {
    expect(
      otherBatchEnrollmentWhere({
        studentId: "stu_1",
        courseId: "crs_1",
        exceptBatchId: "bat_morning",
      }),
    ).toEqual({
      studentId: "stu_1",
      batchId: { not: "bat_morning" },
      batch: { courseId: "crs_1" },
    });
  });
});
