import { hasAttendanceAccess, hasCoursesRead, hasSessionsRead, hasStudentsRead } from "@/lib/permissions";

export type CoursePortal = "teacher" | "admin";

const ADMIN_CLASSROOM = new Set(["sessions", "schedule", "roster", "attendance", "uploads", "assignments"]);

export function parseCoursePortal(value: unknown): CoursePortal {
  return value === "admin" ? "admin" : "teacher";
}

export function courseHref(portal: CoursePortal, courseId: string, suffix = "", subjectId?: string) {
  if (portal === "admin") {
    const head = suffix.split("/")[0] ?? "";
    if (subjectId) return `/admin/courses/${courseId}/subjects/${subjectId}/${suffix || "sessions"}`;
    if (ADMIN_CLASSROOM.has(head)) return `/admin/courses/${courseId}`;
    return suffix ? `/admin/courses/${courseId}/${suffix}` : `/admin/courses/${courseId}`;
  }
  const path = suffix ? `/teacher/courses/${courseId}/${suffix}` : `/teacher/courses/${courseId}`;
  return subjectId ? withSubjectQuery(path, subjectId) : path;
}

export function sessionListHref(portal: CoursePortal, courseId: string, categoryId?: string, subjectId?: string) {
  const path = courseHref(portal, courseId, portal === "admin" ? "sessions" : "", subjectId);
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function scheduleHref(portal: CoursePortal, courseId: string, subjectId?: string) {
  return courseHref(portal, courseId, "schedule", subjectId);
}

export function attendanceHref(portal: CoursePortal, courseId: string, categoryId?: string, subjectId?: string) {
  const path = courseHref(portal, courseId, "attendance", subjectId);
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function withSubjectQuery(href: string, subjectId?: string) {
  if (!subjectId) return href;
  return href.includes("?") ? `${href}&subject=${subjectId}` : `${href}?subject=${subjectId}`;
}

export function sessionHref(portal: CoursePortal, sessionId: string) {
  return portal === "admin" ? `/admin/sessions/${sessionId}` : `/teacher/sessions/${sessionId}`;
}

export function teacherCourseTabSlugs(permissions: readonly string[], canConfigure: boolean): string[] {
  const slugs: string[] = [];
  if (hasSessionsRead(permissions)) slugs.push("");
  if (canConfigure) slugs.push("schedule");
  if (hasStudentsRead(permissions)) slugs.push("roster");
  if (hasAttendanceAccess(permissions)) slugs.push("attendance");
  if (hasCoursesRead(permissions)) {
    slugs.push("uploads", "assignments");
  }
  if (canConfigure) slugs.push("settings");
  return slugs;
}

export function firstTeacherCoursePath(courseId: string, permissions: readonly string[]): string {
  const base = `/teacher/courses/${courseId}`;
  if (hasSessionsRead(permissions)) return base;
  if (hasStudentsRead(permissions)) return `${base}/roster`;
  if (hasAttendanceAccess(permissions)) return `${base}/attendance`;
  if (hasCoursesRead(permissions)) return `${base}/uploads`;
  return "/teacher";
}

export function deniedCourseHref(portal: CoursePortal) {
  return portal === "admin" ? "/admin/courses" : "/teacher";
}

export function safeWorkspaceReturnTo(raw: unknown, fallback: string) {
  if (typeof raw !== "string" || raw.includes("://")) return fallback;
  if (!raw.startsWith("/teacher/") && !raw.startsWith("/admin/")) return fallback;
  const [pathname, query] = raw.split("?");
  if (!pathname) return fallback;
  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const key of ["category", "subject"] as const) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const next = kept.toString();
  return next ? `${pathname}?${next}` : pathname;
}
