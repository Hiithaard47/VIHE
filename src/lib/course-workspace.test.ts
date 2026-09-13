import { describe, expect, it } from "vitest";
import {
  courseHref,
  deniedCourseHref,
  parseCoursePortal,
  safeWorkspaceReturnTo,
  sessionHref,
  sessionListHref,
} from "@/lib/course-workspace";

describe("course workspace paths", () => {
  it("keeps teacher sessions on the course root", () => {
    expect(courseHref("teacher", "c1")).toBe("/teacher/courses/c1");
    expect(courseHref("teacher", "c1", "assignments")).toBe("/teacher/courses/c1/assignments");
    expect(sessionListHref("teacher", "c1", "cls", undefined, "b1")).toBe("/teacher/courses/c1?batch=b1&category=cls");
  });

  it("puts admin classroom pages under the batch", () => {
    expect(courseHref("admin", "c1")).toBe("/admin/courses/c1");
    expect(courseHref("admin", "c1", "sessions", "b1")).toBe("/admin/courses/c1/batches/b1/sessions");
    expect(courseHref("admin", "c1", "roster", "b1")).toBe("/admin/courses/c1/batches/b1/roster");
    expect(sessionListHref("admin", "c1", "cls", undefined, "b1")).toBe(
      "/admin/courses/c1/batches/b1/sessions?category=cls",
    );
    expect(sessionHref("admin", "s1")).toBe("/admin/sessions/s1");
    expect(deniedCourseHref("admin")).toBe("/admin/courses");
  });

  it("only trusts in-app teacher or admin return paths", () => {
    expect(parseCoursePortal("admin")).toBe("admin");
    expect(parseCoursePortal("teacher")).toBe("teacher");
    expect(safeWorkspaceReturnTo("/admin/sessions/s1?flash=1", "/fallback")).toBe("/admin/sessions/s1");
    expect(safeWorkspaceReturnTo("/teacher/courses/c1?category=cls&week=2&flash=ok", "/fallback")).toBe(
      "/teacher/courses/c1?category=cls&week=2",
    );
    expect(safeWorkspaceReturnTo("/teacher/courses/c1/schedule?batch=b1&flash=ok", "/fallback")).toBe(
      "/teacher/courses/c1/schedule?batch=b1",
    );
    expect(safeWorkspaceReturnTo("https://evil.example/admin", "/fallback")).toBe("/fallback");
  });
});
