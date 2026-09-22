import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("./assign-dialog", () => ({
  AssignSessionHomeworkDialog: () => createElement("button", null, "Assign homework"),
}));

vi.mock("../actions", () => ({
  removeSessionHomework: vi.fn(),
  submitSessionHomework: vi.fn(),
}));

import { SessionHomeworkPanel, StudentSessionHomework } from "./session-homework-panel";

describe("SessionHomeworkPanel", () => {
  it("shows empty state when no homework", () => {
    const html = renderToStaticMarkup(
      createElement(SessionHomeworkPanel, {
        sessionId: "sess_1",
        homework: null,
        canManage: true,
        portal: "teacher",
        students: [],
      }),
    );
    expect(html).toContain("No homework assigned");
    expect(html).toContain("Assign homework");
  });

  it("lists submissions for students", () => {
    const html = renderToStaticMarkup(
      createElement(SessionHomeworkPanel, {
        sessionId: "sess_1",
        homework: {
          id: "hw_1",
          title: "Reading",
          instructions: "Ch 1",
          submissions: [
            {
              id: "sub_1",
              submittedAt: new Date("2026-01-02T00:00:00.000Z"),
              student: { id: "stu_1", name: "Ada", rollNumber: "R1" },
              files: [{ id: "f1", fileName: "a.pdf" }],
            },
          ],
        },
        canManage: false,
        portal: "teacher",
        students: [{ id: "stu_1", name: "Ada", rollNumber: "R1" }],
      }),
    );
    expect(html).toContain("Reading");
    expect(html).toContain("Ada");
    expect(html).toContain("a.pdf");
    expect(html).toContain("/homework/submission-files/f1");
  });
});

describe("StudentSessionHomework", () => {
  it("shows submit form when allowed", () => {
    const html = renderToStaticMarkup(
      createElement(StudentSessionHomework, {
        courseId: "course_1",
        sessionId: "sess_1",
        homework: { title: "Reading", instructions: null },
        submission: null,
        canSubmit: true,
        courseActive: true,
      }),
    );
    expect(html).toContain("Reading");
    expect(html).toContain("Upload your work");
    expect(html).toContain("Submit homework");
  });

  it("explains when submit is not allowed", () => {
    const html = renderToStaticMarkup(
      createElement(StudentSessionHomework, {
        courseId: "course_1",
        sessionId: "sess_1",
        homework: { title: "Reading", instructions: null },
        submission: null,
        canSubmit: false,
        courseActive: true,
      }),
    );
    expect(html).toContain("You can submit homework only on the session day.");
  });
});
