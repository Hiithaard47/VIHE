import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SUBJECT_NAME } from "@/lib/subjects";
import { applyDefaultLoginExpiry } from "@/lib/student-login";

type EnrollmentTransaction = Prisma.TransactionClient;

async function enrollStudentInCourseWithClient(
  studentId: string,
  courseId: string,
  tx: EnrollmentTransaction,
) {
  await tx.courseEnrollment.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    create: { courseId, studentId },
    update: {},
  });
  await applyDefaultLoginExpiry(studentId, courseId, tx);
}

export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  tx?: EnrollmentTransaction,
) {
  if (tx) return enrollStudentInCourseWithClient(studentId, courseId, tx);
  return prisma.$transaction((transaction) =>
    enrollStudentInCourseWithClient(studentId, courseId, transaction),
  );
}

export async function unenrollStudentFromCourse(studentId: string, courseId: string) {
  await prisma.courseEnrollment.deleteMany({ where: { studentId, courseId } });
}

export function studentEnrollmentWhere(studentId: string) {
  return { studentId };
}

export async function findStudentCourseEnrollment(studentId: string, courseId: string) {
  return prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
    include: {
      course: { select: { id: true, name: true, code: true, description: true, isActive: true } },
    },
  });
}

export async function getOrCreateDefaultSubject(courseId: string, tx?: EnrollmentTransaction) {
  return (tx ?? prisma).courseSubject.upsert({
    where: { courseId_name: { courseId, name: DEFAULT_SUBJECT_NAME } },
    create: { courseId, name: DEFAULT_SUBJECT_NAME },
    update: {},
  });
}
