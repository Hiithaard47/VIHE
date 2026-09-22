import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name }, select: { id: true } });
}

export async function createTeacherRecord(data: {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  roleId: string;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      roles: { create: [{ roleId: data.roleId }] },
    },
  });
}

export async function findCourseByCode(code: string) {
  return prisma.course.findUnique({
    where: { code },
    select: { id: true, isActive: true },
  });
}

export async function runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export async function createStudentInTx(
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
