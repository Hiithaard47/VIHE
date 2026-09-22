import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  assignSessionHomework: vi.fn(),
  assignCourseHomework: vi.fn(),
  removeSessionHomework: vi.fn(),
  submitSessionHomework: vi.fn(),
}));

vi.mock("./ui/course-homework-view", () => ({
  CourseHomeworkView: vi.fn(),
}));

vi.mock("./ui/assign-dialog", () => ({
  AssignSessionHomeworkDialog: vi.fn(),
}));

vi.mock("./ui/session-homework-panel", () => ({
  SessionHomeworkPanel: vi.fn(),
  StudentSessionHomework: vi.fn(),
}));

vi.mock("./ui/student-course-homework-view", () => ({
  StudentCourseHomeworkView: vi.fn(),
}));

vi.mock("./service/queries", () => ({
  getSubmissionFileForDownload: vi.fn(),
}));

import * as mod from "./index";

describe("session-homework public exports", () => {
  it("re-exports actions, ui, and query helpers", () => {
    expect(mod.assignSessionHomework).toBeTypeOf("function");
    expect(mod.assignCourseHomework).toBeTypeOf("function");
    expect(mod.removeSessionHomework).toBeTypeOf("function");
    expect(mod.submitSessionHomework).toBeTypeOf("function");
    expect(mod.CourseHomeworkView).toBeTypeOf("function");
    expect(mod.AssignSessionHomeworkDialog).toBeTypeOf("function");
    expect(mod.SessionHomeworkPanel).toBeTypeOf("function");
    expect(mod.StudentSessionHomework).toBeTypeOf("function");
    expect(mod.StudentCourseHomeworkView).toBeTypeOf("function");
    expect(mod.getSubmissionFileForDownload).toBeTypeOf("function");
  });
});
