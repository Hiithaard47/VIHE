export type CoursePortal = "teacher" | "admin";

export function parseCoursePortal(value: unknown): CoursePortal {
  return value === "admin" ? "admin" : "teacher";
}

export function courseHref(portal: CoursePortal, courseId: string, suffix = "", batchId?: string) {
  if (portal === "admin" && batchId) {
    return `/admin/courses/${courseId}/batches/${batchId}/${suffix || "sessions"}`;
  }
  if (portal === "teacher") {
    const path = suffix ? `/teacher/courses/${courseId}/${suffix}` : `/teacher/courses/${courseId}`;
    return batchId ? withBatchQuery(path, batchId) : path;
  }
  const root = `/admin/courses/${courseId}`;
  return suffix ? `${root}/${suffix}` : root;
}

export function sessionListHref(
  portal: CoursePortal,
  courseId: string,
  categoryId?: string,
  week?: number,
  batchId?: string,
) {
  const path = courseHref(portal, courseId, portal === "admin" ? "sessions" : "", batchId);
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  if (categoryId) params.set("category", categoryId);
  if (week && week > 1) params.set("week", String(week));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function scheduleHref(portal: CoursePortal, courseId: string, week?: number, batchId?: string) {
  const path = courseHref(portal, courseId, "schedule", batchId);
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  if (week && week > 1) params.set("week", String(week));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
  for (const key of ["category", "week", "batch"] as const) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const next = kept.toString();
  return next ? `${pathname}?${next}` : pathname;
}
