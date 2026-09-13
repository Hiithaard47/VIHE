import { describe, expect, it } from "vitest";
import { isTeacherNavActive } from "@/lib/teacher-nav";

describe("isTeacherNavActive", () => {
  it("highlights Courses on the portal home and course pages", () => {
    expect(isTeacherNavActive("/teacher", "/teacher")).toBe(true);
    expect(isTeacherNavActive("/teacher/courses/c1/roster", "/teacher")).toBe(true);
    expect(isTeacherNavActive("/teacher/sessions/s1", "/teacher")).toBe(true);
    expect(isTeacherNavActive("/teacher/students", "/teacher")).toBe(false);
    expect(isTeacherNavActive("/teacher/account", "/teacher")).toBe(false);
  });

  it("highlights Students on the directory and nested student pages", () => {
    expect(isTeacherNavActive("/teacher/students", "/teacher/students")).toBe(true);
    expect(isTeacherNavActive("/teacher/students/abc", "/teacher/students")).toBe(true);
    expect(isTeacherNavActive("/teacher", "/teacher/students")).toBe(false);
    expect(isTeacherNavActive("/teacher/courses/c1", "/teacher/students")).toBe(false);
  });
});
