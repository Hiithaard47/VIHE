import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_BATCH_NAME } from "../src/lib/batches";

// Separate client instance for direct test setup/assertions — independent
// of the app's own src/lib/prisma singleton, kept simple with a relative
// import since Playwright's test runner doesn't need the `@/*` path alias.
export const prisma = new PrismaClient();

export async function createTeacher(name: string, email: string, password: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "Teacher" } });
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { name, email, passwordHash, roles: { create: [{ roleId: role.id }] } },
  });
}

export async function createCourse(name: string, code: string, teacherId?: string) {
  return prisma.course.create({
    data: {
      name,
      code,
      batches: {
        create: {
          name: DEFAULT_BATCH_NAME,
          teachers: teacherId ? { create: [{ teacherId }] } : undefined,
        },
      },
    },
    include: { batches: true },
  });
}

export async function createStudent(name: string, rollNumber: string, batchId?: string) {
  return prisma.student.create({
    data: {
      name,
      rollNumber,
      enrollments: batchId ? { create: [{ batchId }] } : undefined,
    },
  });
}

export async function createSession(batchId: string, createdById: string, date = new Date()) {
  return prisma.classSession.create({ data: { batchId, date, createdById } });
}
