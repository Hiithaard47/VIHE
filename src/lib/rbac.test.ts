import { describe, it, expect } from "vitest";
import { isSubjectAssignableToCourse } from "@/lib/subject-access";

describe("subject assignment RBAC helpers", () => {
  it("only assigns active subjects from the selected course", () => {
    expect(
      isSubjectAssignableToCourse({ courseId: "course_1", isActive: true }, "course_1"),
    ).toBe(true);
    expect(
      isSubjectAssignableToCourse({ courseId: "course_1", isActive: false }, "course_1"),
    ).toBe(false);
    expect(
      isSubjectAssignableToCourse({ courseId: "course_2", isActive: true }, "course_1"),
    ).toBe(false);
  });
});
