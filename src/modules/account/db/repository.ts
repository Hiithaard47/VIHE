import { prisma } from "@/lib/prisma";

export async function findUserCredentials(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isActive: true },
  });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function findStudentCredentials(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    select: { passwordHash: true, isActive: true },
  });
}

export async function updateStudentPasswordHash(studentId: string, passwordHash: string) {
  return prisma.student.update({ where: { id: studentId }, data: { passwordHash } });
}
