import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";

export type BatchScope = { kind: "all" } | { kind: "ids"; ids: readonly string[] };

export function batchWhere(scope: BatchScope) {
  if (scope.kind === "all") return { isActive: true };
  return { id: { in: [...scope.ids] } };
}

export function sessionWhere(courseId: string, scope: BatchScope) {
  if (scope.kind === "all") return { batch: { courseId } };
  if (scope.ids.length === 1) return { batchId: scope.ids[0] };
  return scope.ids.length === 0 ? { id: { in: [] } } : { batchId: { in: [...scope.ids] } };
}

export function narrowScope(scope: BatchScope, selectedBatchId?: string | null): BatchScope | null {
  if (!selectedBatchId) return scope;
  if (scope.kind === "all" || scope.ids.includes(selectedBatchId)) {
    return { kind: "ids", ids: [selectedBatchId] };
  }
  return null;
}

export function writableBatchId(scope: BatchScope, requestedBatchId?: string | null) {
  if (!requestedBatchId) return null;
  if (scope.kind === "all" || scope.ids.includes(requestedBatchId)) return requestedBatchId;
  return null;
}

export function isCourseAdmin(session: Session) {
  return session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE);
}

export async function resolveCourseScope(session: Session, courseId: string): Promise<BatchScope | null> {
  if (isCourseAdmin(session)) return { kind: "all" };
  const rows = await prisma.batchTeacher.findMany({
    where: { teacherId: session.user.id, batch: { courseId, isActive: true } },
    orderBy: { batch: { createdAt: "asc" } },
    select: { batchId: true },
  });
  if (rows.length === 0) return null;
  return { kind: "ids", ids: rows.map((row) => row.batchId) };
}

export async function resolveWorkspaceScope(
  session: Session,
  courseId: string,
  selectedBatchId?: string | null,
): Promise<BatchScope | null> {
  const scope = await resolveCourseScope(session, courseId);
  if (!scope) return null;
  return selectedBatchId ? narrowScope(scope, selectedBatchId) : scope;
}

export async function assertWritableBatch(
  session: Session,
  courseId: string,
  requestedBatchId?: string | null,
): Promise<string | null> {
  const scope = await resolveCourseScope(session, courseId);
  if (!scope) return null;
  const batchId = writableBatchId(scope, requestedBatchId);
  if (!batchId) return null;
  const batch = await prisma.courseBatch.findFirst({
    where: { id: batchId, courseId, isActive: true },
    select: { id: true },
  });
  return batch?.id ?? null;
}
