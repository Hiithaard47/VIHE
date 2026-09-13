import { describe, expect, it } from "vitest";
import {
  attendanceHref,
  courseHref,
  deniedCourseHref,
  firstTeacherCoursePath,
  parseCoursePortal,
  safeWorkspaceReturnTo,
  sessionHref,
  sessionListHref,
  teacherCourseTabSlugs,
} from "@/lib/course-workspace";
import { PERMISSIONS } from "@/lib/permissions";

describe("course workspace paths", () => {
  it("keeps teacher sessions on the course root", () => {
    expect(courseHref("teacher", "c1")).toBe("/teacher/courses/c1");
    expect(courseHref("teacher", "c1", "assignments")).toBe("/teacher/courses/c1/assignments");
    expect(sessionListHref("teacher", "c1", "cls", "b1")).toBe("/teacher/courses/c1?batch=b1&category=cls");
  });

  it("puts admin classroom pages under the batch", () => {
    expect(courseHref("admin", "c1")).toBe("/admin/courses/c1");
    expect(courseHref("admin", "c1", "sessions", "b1")).toBe("/admin/courses/c1/batches/b1/sessions");
    expect(courseHref("admin", "c1", "roster", "b1")).toBe("/admin/courses/c1/batches/b1/roster");
    expect(courseHref("admin", "c1", "roster")).toBe("/admin/courses/c1");
    expect(sessionListHref("admin", "c1", "cls", "b1")).toBe("/admin/courses/c1/batches/b1/sessions?category=cls");
    expect(attendanceHref("teacher", "c1", "cls", "b1")).toBe("/teacher/courses/c1/attendance?batch=b1&category=cls");
    expect(attendanceHref("admin", "c1", "cls", "b1")).toBe(
      "/admin/courses/c1/batches/b1/attendance?category=cls",
    );
    expect(sessionHref("admin", "s1")).toBe("/admin/sessions/s1");
    expect(deniedCourseHref("admin")).toBe("/admin/courses");
  });

  it("only trusts in-app teacher or admin return paths", () => {
    expect(parseCoursePortal("admin")).toBe("admin");
    expect(parseCoursePortal("teacher")).toBe("teacher");
    expect(safeWorkspaceReturnTo("/admin/sessions/s1?flash=1", "/fallback")).toBe("/admin/sessions/s1");
    expect(safeWorkspaceReturnTo("/teacher/courses/c1?category=cls&week=2&flash=ok", "/fallback")).toBe(
      "/teacher/courses/c1?category=cls",
    );
    expect(safeWorkspaceReturnTo("/teacher/courses/c1/schedule?batch=b1&flash=ok", "/fallback")).toBe(
      "/teacher/courses/c1/schedule?batch=b1",
    );
    expect(safeWorkspaceReturnTo("https://evil.example/admin", "/fallback")).toBe("/fallback");
  });
});

describe("teacher course tabs", () => {
  it("shows sessions only when sessions.read is implied", () => {
    expect(teacherCourseTabSlugs([PERMISSIONS.SESSIONS_READ], false)).toEqual([""]);
    expect(teacherCourseTabSlugs([PERMISSIONS.STUDENTS_READ], false)).toEqual(["roster"]);
  });

  it("shows schedule and settings only when configure is true", () => {
    expect(teacherCourseTabSlugs([PERMISSIONS.COURSES_CONFIGURE, PERMISSIONS.SESSIONS_MANAGE], true)).toEqual([
      "",
      "schedule",
      "uploads",
      "assignments",
      "settings",
    ]);
  });

  it("adds roster when students.read is present", () => {
    const slugs = teacherCourseTabSlugs(
      [PERMISSIONS.COURSES_CONFIGURE, PERMISSIONS.SESSIONS_MANAGE, PERMISSIONS.STUDENTS_READ],
      true,
    );
    expect(slugs).toContain("roster");
  });

  it("picks the first allowed course path", () => {
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.SESSIONS_READ])).toBe("/teacher/courses/c1");
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.STUDENTS_READ])).toBe("/teacher/courses/c1/roster");
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.ATTENDANCE_VIEW])).toBe("/teacher/courses/c1/attendance");
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.COURSES_READ])).toBe("/teacher/courses/c1/uploads");
  });
});
