import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_BATCH_NAME } from "../src/lib/batches";
import {
  DEFAULT_SESSION_CATEGORY_MIN_PERCENT,
  DEFAULT_SESSION_CATEGORY_NAME,
} from "../src/lib/session-categories";

// Separate client for fixture setup/assertions. Playwright sets DATABASE_URL
// to TEST_DATABASE_URL in playwright.config.ts before this module loads.
export const prisma = new PrismaClient();

async function createStaff(name: string, email: string, password: string, roleName: "Admin" | "Teacher", phone?: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { name, email, phone, passwordHash, roles: { create: [{ roleId: role.id }] } },
  });
}

export async function createAdmin(name: string, email: string, password: string) {
  return createStaff(name, email, password, "Admin");
}

export async function createTeacher(name: string, email: string, password: string, phone?: string) {
  return createStaff(name, email, password, "Teacher", phone);
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

export async function createStudent(
  name: string,
  rollNumber: string,
  batchId?: string,
  contact?: { email?: string; phone?: string; password?: string; loginExpiresAt?: Date },
) {
  return prisma.student.create({
    data: {
      name,
      rollNumber,
      email: contact?.email,
      phone: contact?.phone,
      loginExpiresAt: contact?.loginExpiresAt,
      passwordHash: contact?.password ? await bcrypt.hash(contact.password, 10) : undefined,
      enrollments: batchId ? { create: [{ batchId }] } : undefined,
    },
  });
}

export async function defaultSessionCategory() {
  return prisma.sessionCategory.upsert({
    where: { name: DEFAULT_SESSION_CATEGORY_NAME },
    create: {
      name: DEFAULT_SESSION_CATEGORY_NAME,
      minAttendancePercent: DEFAULT_SESSION_CATEGORY_MIN_PERCENT,
      isSystem: true,
    },
    update: {},
  });
}

export async function createSession(batchId: string, createdById: string, date = new Date(), name = DEFAULT_SESSION_CATEGORY_NAME) {
  const category = await defaultSessionCategory();
  return prisma.classSession.create({
    data: { batchId, date, createdById, name, categoryId: category.id },
  });
}
