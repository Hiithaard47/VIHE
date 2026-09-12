import { describe, expect, it } from "vitest";
import { courseHref, deniedCourseHref, parseCoursePortal, safeWorkspaceReturnTo, sessionHref } from "@/lib/course-workspace";

describe("course workspace paths", () => {
  it("keeps teacher sessions on the course root", () => {
    expect(courseHref("teacher", "c1")).toBe("/teacher/courses/c1");
    expect(courseHref("teacher", "c1", "assignments")).toBe("/teacher/courses/c1/assignments");
  });

  it("puts admin classroom pages under the admin course", () => {
    expect(courseHref("admin", "c1")).toBe("/admin/courses/c1/sessions");
    expect(courseHref("admin", "c1", "roster")).toBe("/admin/courses/c1/roster");
    expect(sessionHref("admin", "s1")).toBe("/admin/sessions/s1");
    expect(deniedCourseHref("admin")).toBe("/admin/courses");
  });

  it("only trusts in-app teacher or admin return paths", () => {
    expect(parseCoursePortal("admin")).toBe("admin");
    expect(parseCoursePortal("teacher")).toBe("teacher");
    expect(safeWorkspaceReturnTo("/admin/sessions/s1?flash=1", "/fallback")).toBe("/admin/sessions/s1");
    expect(safeWorkspaceReturnTo("https://evil.example/admin", "/fallback")).toBe("/fallback");
  });
});
