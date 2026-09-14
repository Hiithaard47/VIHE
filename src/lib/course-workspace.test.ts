import { describe, expect, it } from "vitest";
import {
  attendanceHref,
  courseHref,
  safeWorkspaceReturnTo,
  sessionListHref,
} from "@/lib/course-workspace";

describe("course workspace hrefs", () => {
  it("keeps teacher classroom pages under the course with a subject query", () => {
    expect(sessionListHref("teacher", "c1", "cls", "b1")).toBe("/teacher/courses/c1?subject=b1&category=cls");
  });

  it("puts admin classroom pages under the subject", () => {
    expect(courseHref("admin", "c1", "sessions", "b1")).toBe("/admin/courses/c1/subjects/b1/sessions");
    expect(courseHref("admin", "c1", "roster", "b1")).toBe("/admin/courses/c1/subjects/b1/roster");
    expect(sessionListHref("admin", "c1", "cls", "b1")).toBe("/admin/courses/c1/subjects/b1/sessions?category=cls");
    expect(attendanceHref("teacher", "c1", "cls", "b1")).toBe("/teacher/courses/c1/attendance?subject=b1&category=cls");
    expect(attendanceHref("admin", "c1", "cls", "b1")).toBe(
      "/admin/courses/c1/subjects/b1/attendance?category=cls",
    );
  });

  it("strips flash params from workspace return paths", () => {
    expect(safeWorkspaceReturnTo("/teacher/courses/c1/schedule?subject=b1&flash=ok", "/fallback")).toBe(
      "/teacher/courses/c1/schedule?subject=b1",
    );
  });
});
