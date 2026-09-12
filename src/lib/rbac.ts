import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { flashUrl } from "@/lib/flash";
import { courseHref, deniedCourseHref, type CoursePortal } from "@/lib/course-workspace";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export const ARCHIVED_COURSE_MESSAGE = "This course is archived. An admin can restore it to make changes.";

export async function requireActiveCourse(courseId: string, path: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isActive: true },
  });
  if (!course) redirect("/admin/courses");
  if (!course.isActive) redirect(flashUrl(path, "error", ARCHIVED_COURSE_MESSAGE));
}

// Fetches the current, de-duplicated permission set for a user across all
// their roles. Called on every sign-in / JWT refresh so role edits made by
// an admin take effect the next time the token is refreshed.
export async function getUserPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  const roles = new Set<string>();
  const permissions = new Set<string>();

  for (const ur of userRoles) {
    roles.add(ur.role.name);
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }

  return { roles: [...roles], permissions: [...permissions] };
}

export function can(userPermissions: string[], permission: PermissionKey): boolean {
  return userPermissions.includes(permission);
}

// Server-component/server-action guard: redirects to /login when signed
// out, or to / when signed in but missing every listed permission.
export async function requireAnyPermission(permissions: PermissionKey[]) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.kind === "student") redirect("/student");
  const hasAccess = permissions.some((p) => session.user.permissions.includes(p));
  if (!hasAccess) redirect("/");
  return session;
}

export async function requireStudent() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.kind !== "student") redirect("/");
  return session;
}

export async function requirePermission(permission: PermissionKey) {
  return requireAnyPermission([permission]);
}

export async function canManageBatch(session: Session, batchId: string) {
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: { isActive: true, course: { select: { isActive: true } } },
  });
  if (!batch?.course.isActive) return false;
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  if (!batch.isActive) return false;
  const assignment = await prisma.batchTeacher.findFirst({
    where: { batchId, teacherId: session.user.id },
  });
  return Boolean(assignment);
}

export async function canAccessBatch(session: Session, batchId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) {
    const batch = await prisma.courseBatch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    return Boolean(batch);
  }
  return canManageBatch(session, batchId);
}

export async function requireBatchAccess(batchId: string, portal: CoursePortal = "teacher") {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);
  if (!(await canManageBatch(session, batchId))) redirect(deniedCourseHref(portal));
  return session;
}

export async function requireBatchView(batchId: string, portal: CoursePortal = "teacher") {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);
  if (!(await canAccessBatch(session, batchId))) redirect(deniedCourseHref(portal));
  return session;
}

export async function canConfigureBatch(session: Session, batchId: string) {
  const isAdmin = session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE);
  if (!isAdmin && !session.user.permissions.includes(PERMISSIONS.COURSES_CONFIGURE)) {
    return false;
  }
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: { isActive: true, course: { select: { isActive: true } } },
  });
  if (!batch?.course.isActive) return false;
  if (isAdmin) return true;
  if (!batch.isActive) return false;
  const assignment = await prisma.batchTeacher.findFirst({
    where: { batchId, teacherId: session.user.id },
  });
  return Boolean(assignment);
}

export async function requireBatchConfigure(batchId: string, portal: CoursePortal = "teacher") {
  const session = await requireAnyPermission([
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);
  if (!(await canConfigureBatch(session, batchId))) {
    redirect(deniedCourseHref(portal));
  }
  return session;
}

// Non-redirecting check: can this user manage (create sessions, mark
// attendance for) a given course? Admins can manage any course; teachers
// only courses they're assigned to via any batch.
export async function canManageCourse(session: Session, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isActive: true },
  });
  if (!course?.isActive) return false;
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;

  const assignment = await prisma.batchTeacher.findFirst({
    where: { teacherId: session.user.id, batch: { courseId, isActive: true } },
  });
  return Boolean(assignment);
}

export async function canAccessCourse(session: Session, courseId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    return Boolean(course);
  }
  return canManageCourse(session, courseId);
}

// Server-action guard: redirects away if the signed-in user may not open
// this course. Admins can open any course; teachers need an assignment.
export async function requireCourseAccess(courseId: string, portal: CoursePortal = "teacher") {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  if (!(await canAccessCourse(session, courseId))) redirect(deniedCourseHref(portal));

  return session;
}

// Non-redirecting check: can this user configure (edit details, policy,
// roster, schedule for) a given course? Admins holding COURSES_MANAGE can
// configure any course; everyone else needs COURSES_CONFIGURE *and* a batch
// assignment on this course.
export async function canConfigureCourse(session: Session, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isActive: true },
  });
  if (!course?.isActive) return false;
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  if (!session.user.permissions.includes(PERMISSIONS.COURSES_CONFIGURE)) return false;

  const assignment = await prisma.batchTeacher.findFirst({
    where: { teacherId: session.user.id, batch: { courseId, isActive: true } },
  });
  return Boolean(assignment);
}

// Server-action / page guard: redirects back to the course when the
// signed-in user may not configure it.
export async function requireCourseConfigure(courseId: string, portal: CoursePortal = "teacher") {
  const session = await requireAnyPermission([
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);

  if (!(await canConfigureCourse(session, courseId))) redirect(courseHref(portal, courseId));

  return session;
}
