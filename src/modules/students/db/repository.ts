import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findStudentActive(studentId: string) {
  return prisma.student.findUnique({ where: { id: studentId }, select: { isActive: true } });
}

export async function createStudentRecord(
  tx: Prisma.TransactionClient,
  data: {
    name: string;
    rollNumber: string;
    email?: string;
    phone?: string;
    passwordHash?: string;
  },
) {
  return tx.student.create({ data });
}

export async function updateStudentRecord(
  studentId: string,
  data: {
    name: string;
    rollNumber: string;
    email: string | null;
    phone: string | null;
    loginExpiresAt?: Date | null;
    passwordHash?: string;
  },
) {
  return prisma.student.update({ where: { id: studentId }, data });
}

export async function toggleStudentActiveRecord(studentId: string, isActive: boolean) {
  return prisma.student.update({ where: { id: studentId }, data: { isActive } });
}

export async function findApplication(applicationId: string) {
  return prisma.studentApplication.findUniqueOrThrow({ where: { id: applicationId } });
}

export async function findCourseActive(courseId: string) {
  return prisma.course.findUnique({ where: { id: courseId }, select: { isActive: true } });
}

export async function runStudentTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export async function findEnrollableCourse(tx: Prisma.TransactionClient, courseId: string) {
  return tx.course.findUnique({ where: { id: courseId }, select: { isActive: true } });
}

export async function deleteEnrollment(tx: Prisma.TransactionClient, studentId: string, courseId: string) {
  return tx.courseEnrollment.deleteMany({ where: { studentId, courseId } });
}

export async function findEnrollment(tx: Prisma.TransactionClient, courseId: string, studentId: string) {
  return tx.courseEnrollment.findUnique({ where: { courseId_studentId: { courseId, studentId } } });
}

export async function updateApplicationStatus(
  tx: Prisma.TransactionClient,
  applicationId: string,
  data: { status: "APPROVED" | "REJECTED"; reviewedAt: Date; reviewedById: string },
) {
  return tx.studentApplication.update({ where: { id: applicationId }, data });
}

export async function rejectApplicationRecord(applicationId: string, reviewedById: string) {
  return prisma.studentApplication.update({
    where: { id: applicationId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById },
  });
}
