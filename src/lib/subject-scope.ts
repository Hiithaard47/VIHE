import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";

export type SubjectScope = { kind: "all" } | { kind: "ids"; ids: readonly string[] };

export function subjectWhere(scope: SubjectScope) {
  if (scope.kind === "all") return { isActive: true };
  return { id: { in: [...scope.ids] } };
}

export function sessionWhere(courseId: string, scope: SubjectScope) {
  if (scope.kind === "all") return { subject: { courseId } };
  if (scope.ids.length === 1) return { subjectId: scope.ids[0] };
  return scope.ids.length === 0 ? { id: { in: [] } } : { subjectId: { in: [...scope.ids] } };
}

export function narrowScope(scope: SubjectScope, selectedSubjectId?: string | null): SubjectScope | null {
  if (!selectedSubjectId) return scope;
  if (scope.kind === "all" || scope.ids.includes(selectedSubjectId)) {
    return { kind: "ids", ids: [selectedSubjectId] };
  }
  return null;
}

export function writableSubjectId(scope: SubjectScope, requestedSubjectId?: string | null) {
  if (!requestedSubjectId) return null;
  if (scope.kind === "all" || scope.ids.includes(requestedSubjectId)) return requestedSubjectId;
  return null;
}

export function isCourseAdmin(session: Session) {
  return session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE);
}

export async function resolveCourseScope(session: Session, courseId: string): Promise<SubjectScope | null> {
  if (isCourseAdmin(session)) return { kind: "all" };
  const rows = await prisma.subjectTeacher.findMany({
    where: { teacherId: session.user.id, subject: { courseId, isActive: true } },
    orderBy: { subject: { createdAt: "asc" } },
    select: { subjectId: true },
  });
  if (rows.length === 0) return null;
  return { kind: "ids", ids: rows.map((row) => row.subjectId) };
}

export async function resolveWorkspaceScope(
  session: Session,
  courseId: string,
  selectedSubjectId?: string | null,
): Promise<SubjectScope | null> {
  const scope = await resolveCourseScope(session, courseId);
  if (!scope) return null;
  return selectedSubjectId ? narrowScope(scope, selectedSubjectId) : scope;
}

export async function assertWritableSubject(
  session: Session,
  courseId: string,
  requestedSubjectId?: string | null,
): Promise<string | null> {
  const scope = await resolveCourseScope(session, courseId);
  if (!scope) return null;
  const subjectId = writableSubjectId(scope, requestedSubjectId);
  if (!subjectId) return null;
  const subject = await prisma.courseSubject.findFirst({
    where: { id: subjectId, courseId, isActive: true },
    select: { id: true },
  });
  return subject?.id ?? null;
}

/** Distinct error when a subject exists on the course but is archived. */
export async function subjectWriteDeniedMessage(
  courseId: string,
  requestedSubjectId?: string | null,
): Promise<string> {
  if (!requestedSubjectId) return "Pick a subject.";
  const subject = await prisma.courseSubject.findFirst({
    where: { id: requestedSubjectId, courseId },
    select: { isActive: true },
  });
  if (subject && !subject.isActive) return "This subject is archived. Restore it to add sessions.";
  return "You are not assigned to that subject.";
}
