import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLES,
  hasCoursesRead,
  hasSessionsRead,
  hasSessionsManage,
  hasStudentsRead,
  hasAttendanceAccess,
  hasWorkspaceWrite,
  TEACHER_PORTAL_PERMISSIONS,
} from "@/lib/permissions";

describe("permission registry", () => {
  it("defines every PERMISSIONS value in PERMISSION_DEFINITIONS", () => {
    const defined = PERMISSION_DEFINITIONS.map((p) => p.key);
    for (const key of Object.values(PERMISSIONS)) {
      expect(defined).toContain(key);
    }
  });

  it("grants courses.configure to the Teacher role by default", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).toContain(PERMISSIONS.COURSES_CONFIGURE);
  });

  it("keeps courses.manage out of the Teacher role", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).not.toContain(PERMISSIONS.COURSES_MANAGE);
  });

  it("grants students.read to the Teacher role by default", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).toContain(PERMISSIONS.STUDENTS_READ);
  });

  it("keeps students.manage out of the Teacher role", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).not.toContain(PERMISSIONS.STUDENTS_MANAGE);
  });

  it("treats manage and configure as the matching read", () => {
    expect(hasCoursesRead([PERMISSIONS.COURSES_READ])).toBe(true);
    expect(hasCoursesRead([PERMISSIONS.COURSES_MANAGE])).toBe(true);
    expect(hasCoursesRead([PERMISSIONS.COURSES_CONFIGURE])).toBe(true);
    expect(hasCoursesRead([PERMISSIONS.SESSIONS_READ])).toBe(false);

    expect(hasSessionsRead([PERMISSIONS.SESSIONS_READ])).toBe(true);
    expect(hasSessionsRead([PERMISSIONS.SESSIONS_MANAGE])).toBe(true);
    expect(hasSessionsRead([PERMISSIONS.COURSES_READ])).toBe(false);
    expect(hasSessionsManage([PERMISSIONS.SESSIONS_MANAGE])).toBe(true);
    expect(hasSessionsManage([PERMISSIONS.SESSIONS_READ])).toBe(false);

    expect(hasStudentsRead([PERMISSIONS.STUDENTS_READ])).toBe(true);
    expect(hasStudentsRead([PERMISSIONS.STUDENTS_MANAGE])).toBe(true);
    expect(hasStudentsRead([PERMISSIONS.COURSES_READ])).toBe(false);

    expect(hasAttendanceAccess([PERMISSIONS.ATTENDANCE_VIEW])).toBe(true);
    expect(hasAttendanceAccess([PERMISSIONS.ATTENDANCE_MARK])).toBe(true);
    expect(hasAttendanceAccess([PERMISSIONS.SESSIONS_READ])).toBe(false);
  });

  it("lists teacher portal keys including the new reads", () => {
    expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.COURSES_READ);
    expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.SESSIONS_READ);
    expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.STUDENTS_READ);
    expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.SESSIONS_MANAGE);
    expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.ATTENDANCE_VIEW);
  });

  it("treats manage, configure, and mark as workspace writes", () => {
    expect(hasWorkspaceWrite([PERMISSIONS.SESSIONS_MANAGE])).toBe(true);
    expect(hasWorkspaceWrite([PERMISSIONS.COURSES_CONFIGURE])).toBe(true);
    expect(hasWorkspaceWrite([PERMISSIONS.COURSES_MANAGE])).toBe(true);
    expect(hasWorkspaceWrite([PERMISSIONS.ATTENDANCE_MARK])).toBe(true);
    expect(hasWorkspaceWrite([PERMISSIONS.SESSIONS_READ])).toBe(false);
    expect(hasWorkspaceWrite([PERMISSIONS.COURSES_READ])).toBe(false);
    expect(hasWorkspaceWrite([PERMISSIONS.STUDENTS_READ])).toBe(false);
    expect(hasWorkspaceWrite([PERMISSIONS.ATTENDANCE_VIEW])).toBe(false);
  });
});
