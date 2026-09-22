import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("../service/queries", () => ({
  getStudentCourseHomework: vi.fn(async () => ({
    pending: [
      {
        id: "hw1",
        title: "Pending HW",
        session: { id: "s1", name: "Class 1", date: new Date("2026-09-22T00:00:00.000Z") },
        submissions: [],
      },
    ],
    submitted: [
      {
        id: "hw2",
        title: "Done HW",
        session: { id: "s2", name: "Class 2", date: new Date("2026-09-21T00:00:00.000Z") },
        submissions: [{ submittedAt: new Date("2026-09-21T12:00:00.000Z") }],
      },
    ],
  })),
}));

import { StudentCourseHomeworkView } from "./student-course-homework-view";

describe("StudentCourseHomeworkView", () => {
  it("renders pending and submitted groups", async () => {
    const element = await StudentCourseHomeworkView({
      courseId: "course_1",
      studentId: "stu_1",
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Pending");
    expect(html).toContain("Pending HW");
    expect(html).toContain("Submitted");
    expect(html).toContain("Done HW");
    expect(html).toContain("/student/courses/course_1/sessions/s1");
  });
});
