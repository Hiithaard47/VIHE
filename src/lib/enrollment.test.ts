import { describe, it, expect } from "vitest";
import { studentEnrollmentWhere } from "@/lib/enrollment";

describe("studentEnrollmentWhere", () => {
  it("filters by student id", () => {
    expect(studentEnrollmentWhere("stu_1")).toEqual({ studentId: "stu_1" });
  });
});
