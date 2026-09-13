import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BATCH_NAME } from "@/lib/batches";
import { applyDefaultLoginExpiry } from "@/lib/student-login";

type EnrollmentTransaction = Prisma.TransactionClient;

export function otherBatchEnrollmentWhere(args: {
  studentId: string;
  courseId: string;
  exceptBatchId: string;
}) {
  return {
    studentId: args.studentId,
    batchId: { not: args.exceptBatchId },
    batch: { courseId: args.courseId },
  };
}

async function enrollStudentInBatchWithClient(
  studentId: string,
  batchId: string,
  tx: EnrollmentTransaction,
) {
  const batch = await tx.courseBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { id: true, courseId: true },
  });

  await tx.batchEnrollment.deleteMany({
    where: otherBatchEnrollmentWhere({
      studentId,
      courseId: batch.courseId,
      exceptBatchId: batch.id,
    }),
  });
  await tx.batchEnrollment.upsert({
    where: { batchId_studentId: { batchId: batch.id, studentId } },
    create: { batchId, studentId },
    update: {},
  });
  await applyDefaultLoginExpiry(studentId, batch.courseId, tx);
}

export async function enrollStudentInBatch(
  studentId: string,
  batchId: string,
  tx?: EnrollmentTransaction,
) {
  if (tx) return enrollStudentInBatchWithClient(studentId, batchId, tx);
  return prisma.$transaction((transaction) =>
    enrollStudentInBatchWithClient(studentId, batchId, transaction),
  );
}

export async function unenrollStudentFromBatch(studentId: string, batchId: string) {
  await prisma.batchEnrollment.deleteMany({ where: { studentId, batchId } });
}

export function studentEnrollmentWhere(studentId: string) {
  return { studentId };
}

export async function findStudentCourseEnrollment(studentId: string, courseId: string) {
  return prisma.batchEnrollment.findFirst({
    where: { studentId, batch: { courseId } },
    include: {
      batch: {
        select: {
          id: true,
          name: true,
          course: { select: { id: true, name: true, code: true, description: true, isActive: true } },
        },
      },
    },
  });
}

export function pickWritableBatch(
  assignedIds: readonly string[],
  requestedBatchId?: string | null,
  fallbackBatchId?: string | null,
) {
  if (assignedIds.length > 0) {
    if (requestedBatchId && assignedIds.includes(requestedBatchId)) return requestedBatchId;
    return assignedIds[0] ?? null;
  }
  return requestedBatchId || fallbackBatchId || null;
}

export function visibleBatchesWhere(assignedIds: readonly string[]) {
  return assignedIds.length > 0 ? { id: { in: [...assignedIds] } } : { isActive: true };
}

export function narrowAssignedBatches(assignedIds: readonly string[], selectedBatchId?: string | null) {
  if (selectedBatchId && (assignedIds.length === 0 || assignedIds.includes(selectedBatchId))) {
    return [selectedBatchId];
  }
  return [...assignedIds];
}

export function scopedSessionWhere(courseId: string, assignedIds: readonly string[]) {
  if (assignedIds.length === 0) return { batch: { courseId } };
  if (assignedIds.length === 1) return { batchId: assignedIds[0] };
  return { batchId: { in: [...assignedIds] } };
}

export async function resolveTeacherBatchesForCourse(teacherId: string, courseId: string) {
  const rows = await prisma.batchTeacher.findMany({
    where: { teacherId, batch: { courseId, isActive: true } },
    orderBy: { batch: { createdAt: "asc" } },
    select: { batchId: true },
  });
  return rows.map((row) => row.batchId);
}

export async function resolveTeacherBatchForCourse(teacherId: string, courseId: string) {
  const assigned = await resolveTeacherBatchesForCourse(teacherId, courseId);
  return assigned[0] ?? null;
}

export async function resolveWritableBatch(courseId: string, teacherId: string, requestedBatchId?: string | null) {
  const assignedIds = await resolveTeacherBatchesForCourse(teacherId, courseId);
  const chosen = pickWritableBatch(assignedIds, requestedBatchId);
  if (assignedIds.length > 0) return chosen;

  if (chosen) {
    const requested = await prisma.courseBatch.findFirst({
      where: { id: chosen, courseId, isActive: true },
      select: { id: true },
    });
    return requested?.id ?? null;
  }

  const batch = await prisma.courseBatch.findFirst({
    where: { courseId, isActive: true },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return batch?.id ?? null;
}

export async function getOrCreateDefaultBatch(courseId: string, tx?: EnrollmentTransaction) {
  return (tx ?? prisma).courseBatch.upsert({
    where: { courseId_name: { courseId, name: DEFAULT_BATCH_NAME } },
    create: { courseId, name: DEFAULT_BATCH_NAME },
    update: {},
  });
}
