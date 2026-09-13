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

export async function getOrCreateDefaultBatch(courseId: string, tx?: EnrollmentTransaction) {
  return (tx ?? prisma).courseBatch.upsert({
    where: { courseId_name: { courseId, name: DEFAULT_BATCH_NAME } },
    create: { courseId, name: DEFAULT_BATCH_NAME },
    update: {},
  });
}
