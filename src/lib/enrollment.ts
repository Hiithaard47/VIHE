import { prisma } from "@/lib/prisma";

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

export async function enrollStudentInBatch(studentId: string, batchId: string) {
  const batch = await prisma.courseBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { id: true, courseId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.batchEnrollment.deleteMany({
      where: otherBatchEnrollmentWhere({
        studentId,
        courseId: batch.courseId,
        exceptBatchId: batch.id,
      }),
    });
    await tx.batchEnrollment.upsert({
      where: { batchId_studentId: { batchId: batch.id, studentId } },
      create: { batchId: batch.id, studentId },
      update: {},
    });
  });
}

export async function unenrollStudentFromBatch(studentId: string, batchId: string) {
  await prisma.batchEnrollment.deleteMany({ where: { studentId, batchId } });
}

export async function resolveTeacherBatchForCourse(teacherId: string, courseId: string) {
  const row = await prisma.batchTeacher.findFirst({
    where: { teacherId, batch: { courseId, isActive: true } },
    orderBy: { batch: { createdAt: "asc" } },
    select: { batchId: true },
  });
  return row?.batchId ?? null;
}
