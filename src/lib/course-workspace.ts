export type CoursePortal = "teacher" | "admin";

export function parseCoursePortal(value: unknown): CoursePortal {
  return value === "admin" ? "admin" : "teacher";
}

export function courseHref(portal: CoursePortal, courseId: string, suffix = "") {
  const root = portal === "admin" ? `/admin/courses/${courseId}` : `/teacher/courses/${courseId}`;
  if (!suffix) return portal === "admin" ? `${root}/sessions` : root;
  return `${root}/${suffix}`;
}

export function sessionHref(portal: CoursePortal, sessionId: string) {
  return portal === "admin" ? `/admin/sessions/${sessionId}` : `/teacher/sessions/${sessionId}`;
}

export function deniedCourseHref(portal: CoursePortal) {
  return portal === "admin" ? "/admin/courses" : "/teacher";
}

export function safeWorkspaceReturnTo(raw: unknown, fallback: string) {
  if (typeof raw !== "string" || raw.includes("://")) return fallback;
  if (!raw.startsWith("/teacher/") && !raw.startsWith("/admin/")) return fallback;
  return raw.split("?")[0] || fallback;
}
