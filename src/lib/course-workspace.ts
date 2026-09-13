export type CoursePortal = "teacher" | "admin";

const ADMIN_CLASSROOM = new Set(["sessions", "schedule", "roster", "attendance", "uploads", "assignments"]);

export function parseCoursePortal(value: unknown): CoursePortal {
  return value === "admin" ? "admin" : "teacher";
}

export function courseHref(portal: CoursePortal, courseId: string, suffix = "", batchId?: string) {
  if (portal === "admin") {
    const head = suffix.split("/")[0] ?? "";
    if (batchId) return `/admin/courses/${courseId}/batches/${batchId}/${suffix || "sessions"}`;
    if (ADMIN_CLASSROOM.has(head)) return `/admin/courses/${courseId}`;
    return suffix ? `/admin/courses/${courseId}/${suffix}` : `/admin/courses/${courseId}`;
  }
  const path = suffix ? `/teacher/courses/${courseId}/${suffix}` : `/teacher/courses/${courseId}`;
  return batchId ? withBatchQuery(path, batchId) : path;
}

export function sessionListHref(portal: CoursePortal, courseId: string, categoryId?: string, batchId?: string) {
  const path = courseHref(portal, courseId, portal === "admin" ? "sessions" : "", batchId);
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function scheduleHref(portal: CoursePortal, courseId: string, batchId?: string) {
  return courseHref(portal, courseId, "schedule", batchId);
}

export function withBatchQuery(href: string, batchId?: string) {
  if (!batchId) return href;
  return href.includes("?") ? `${href}&batch=${batchId}` : `${href}?batch=${batchId}`;
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
  const [pathname, query] = raw.split("?");
  if (!pathname) return fallback;
  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const key of ["category", "batch"] as const) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const next = kept.toString();
  return next ? `${pathname}?${next}` : pathname;
}
