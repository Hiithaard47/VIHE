import { describe, expect, it } from "vitest";
import { isBatchAssignableToCourse } from "@/lib/batch-access";

describe("batch assignment RBAC helpers", () => {
  it("only assigns active batches from the selected course", () => {
    expect(
      isBatchAssignableToCourse({ courseId: "course_1", isActive: true }, "course_1"),
    ).toBe(true);
    expect(
      isBatchAssignableToCourse({ courseId: "course_1", isActive: false }, "course_1"),
    ).toBe(false);
    expect(
      isBatchAssignableToCourse({ courseId: "course_2", isActive: true }, "course_1"),
    ).toBe(false);
  });
});
