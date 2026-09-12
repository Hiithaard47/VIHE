import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

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
  const hasAccess = permissions.some((p) => session.user.permissions.includes(p));
  if (!hasAccess) redirect("/");
  return session;
}

export async function requirePermission(permission: PermissionKey) {
  return requireAnyPermission([permission]);
}

export async function canManageBatch(session: Session, batchId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  const assignment = await prisma.batchTeacher.findFirst({
    where: { batchId, teacherId: session.user.id, batch: { isActive: true } },
  });
  return Boolean(assignment);
}

export async function requireBatchAccess(batchId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);
  if (!(await canManageBatch(session, batchId))) redirect("/teacher");
  return session;
}

export async function canConfigureBatch(session: Session, batchId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  if (!session.user.permissions.includes(PERMISSIONS.COURSES_CONFIGURE)) return false;
  const assignment = await prisma.batchTeacher.findFirst({
    where: { batchId, teacherId: session.user.id, batch: { isActive: true } },
  });
  return Boolean(assignment);
}

export async function requireBatchConfigure(batchId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);
  if (!(await canConfigureBatch(session, batchId))) {
    redirect(`/teacher`); // Part 2: redirect to batch sessions URL
  }
  return session;
}

// Non-redirecting check: can this user manage (create sessions, mark
// attendance for) a given course? Admins can manage any course; teachers
// only courses they're assigned to via any batch. Everyone with teacher-section
// access can still *view* any course/session — see requireAnyPermission in the
// teacher layout — this only gates the write actions.
export async function canManageCourse(session: Session, courseId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;

  const assignment = await prisma.batchTeacher.findFirst({
    where: { teacherId: session.user.id, batch: { courseId, isActive: true } },
  });
  return Boolean(assignment);
}

// Server-action guard: redirects away if the signed-in user may not manage
// (create sessions / mark attendance for) this course.
export async function requireCourseAccess(courseId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  if (!(await canManageCourse(session, courseId))) redirect("/teacher");

  return session;
}

// Non-redirecting check: can this user configure (edit details, policy,
// roster, schedule for) a given course? Admins holding COURSES_MANAGE can
// configure any course; everyone else needs COURSES_CONFIGURE *and* a batch
// assignment on this course.
export async function canConfigureCourse(session: Session, courseId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  if (!session.user.permissions.includes(PERMISSIONS.COURSES_CONFIGURE)) return false;

  const assignment = await prisma.batchTeacher.findFirst({
    where: { teacherId: session.user.id, batch: { courseId, isActive: true } },
  });
  return Boolean(assignment);
}

// Server-action / page guard: redirects back to the course when the
// signed-in user may not configure it.
export async function requireCourseConfigure(courseId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);

  if (!(await canConfigureCourse(session, courseId))) redirect(`/teacher/courses/${courseId}`);

  return session;
}
