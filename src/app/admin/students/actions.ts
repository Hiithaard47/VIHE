"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { enrollStudentInBatch } from "@/lib/enrollment";
import { DEFAULT_BATCH_NAME } from "@/lib/batches";
import { isBatchAssignableToCourse } from "@/lib/batch-access";
import bcrypt from "bcryptjs";
import { parseDateInput } from "@/lib/time";

const PATH = "/admin/students";
const APPLICATIONS_PATH = `${PATH}?tab=applications`;

const createStudentSchema = z.object({
  name: z.string().min(1),
  rollNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  password: z.string().optional().default(""),
});

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  rollNumber: z.string().trim().min(1, "Roll number is required."),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  password: z.string().optional().default(""),
  loginExpiresAt: z.string().optional().default(""),
});

function getBatchSelections(formData: FormData) {
  return Array.from(formData.entries())
    .filter(([key]) => key.startsWith("batch-"))
    .map(([key, value]) => ({
      courseId: key.slice("batch-".length),
      batchId: String(value),
    }));
}

class InvalidBatchSelectionError extends Error {}

async function requireActiveStudent(studentId: string, path: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { isActive: true } });
  if (!student) redirect(PATH);
  if (!student.isActive) redirect(flashUrl(path, "error", "This student is archived. Restore to make changes."));
}

async function validateBatchSelection(
  tx: Prisma.TransactionClient,
  studentId: string | undefined,
  courseId: string,
  batchId: string,
) {
  const batch = await tx.courseBatch.findUnique({
    where: { id: batchId },
    select: { id: true, courseId: true, isActive: true, course: { select: { isActive: true } } },
  });
  if (!batch?.course.isActive || !isBatchAssignableToCourse(batch, courseId)) {
    if (!studentId || !batch) throw new InvalidBatchSelectionError();

    const existingEnrollment = await tx.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId } },
    });
    if (!existingEnrollment || batch.courseId !== courseId) {
      throw new InvalidBatchSelectionError();
    }
  }
}

export async function createStudent(formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  const parsed = createStudentSchema.safeParse({
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    password: formData.get("password") || "",
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, rollNumber, email, phone, password } = parsed.data;
  if (password && password.length < 8) redirect(flashUrl(PATH, "error", "Portal password must be at least 8 characters."));
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const batchSelections = getBatchSelections(formData);

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          name,
          rollNumber,
          email: email || undefined,
          phone: phone.trim() || undefined,
          passwordHash,
        },
      });
      for (const { courseId, batchId } of batchSelections) {
        if (batchId) {
          await validateBatchSelection(tx, student.id, courseId, batchId);
          await enrollStudentInBatch(student.id, batchId, tx);
        } else {
          await tx.batchEnrollment.deleteMany({
            where: { studentId: student.id, batch: { courseId } },
          });
        }
      }
    });
  } catch (err) {
    if (err instanceof InvalidBatchSelectionError) {
      redirect(flashUrl(PATH, "error", "Select an active batch belonging to the selected course."));
    }
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(PATH, "error", "That roll number or email is already in use."));
    }
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${name} was added.`));
}

export async function updateStudentDetails(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = `/admin/students/${studentId}/details`;
  await requireActiveStudent(studentId, path);
  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    password: formData.get("password") || "",
    loginExpiresAt: formData.get("loginExpiresAt") || "",
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  if (parsed.data.password && parsed.data.password.length < 8) {
    redirect(flashUrl(path, "error", "Portal password must be at least 8 characters."));
  }
  const loginExpiresAt = parsed.data.loginExpiresAt
    ? parseDateInput(parsed.data.loginExpiresAt)
    : null;
  if (parsed.data.loginExpiresAt && !loginExpiresAt) {
    redirect(flashUrl(path, "error", "Enter a valid login expiry date."));
  }

  try {
    await prisma.student.update({
      where: { id: studentId },
      data: {
        name: parsed.data.name,
        rollNumber: parsed.data.rollNumber,
        email: parsed.data.email || null,
        phone: parsed.data.phone.trim() || null,
        loginExpiresAt,
        ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(path, "error", "That roll number or email is already in use."));
    }
    throw err;
  }

  revalidatePath(PATH);
  revalidatePath(`/admin/students/${studentId}`);
  redirect(flashUrl(path, "success", "Student details saved."));
}

export async function updateStudentEnrollments(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = `/admin/students/${studentId}`;
  await requireActiveStudent(studentId, path);

  const batchSelections = getBatchSelections(formData);

  try {
    await prisma.$transaction(async (tx) => {
      for (const { courseId, batchId } of batchSelections) {
        if (batchId) {
          await validateBatchSelection(tx, studentId, courseId, batchId);
          await enrollStudentInBatch(studentId, batchId, tx);
        } else {
          await tx.batchEnrollment.deleteMany({
            where: { studentId, batch: { courseId } },
          });
        }
      }
    });
  } catch (err) {
    if (err instanceof InvalidBatchSelectionError) {
      redirect(flashUrl(PATH, "error", "Select an active batch belonging to the selected course."));
    }
    throw err;
  }

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Enrollment updated."));
}

export async function toggleStudentActive(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = `/admin/students/${studentId}`;
  const nextActive = formData.get("nextActive") === "true";
  await prisma.student.update({ where: { id: studentId }, data: { isActive: nextActive } });

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Student restored." : "Student archived."));
}

export async function approveApplication(applicationId: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  const rollNumber = String(formData.get("rollNumber") ?? "").trim();
  if (!rollNumber) redirect(flashUrl(APPLICATIONS_PATH, "error", "A roll number is required to approve."));

  const application = await prisma.studentApplication.findUniqueOrThrow({ where: { id: applicationId } });
  if (application.status !== "PENDING") redirect(flashUrl(APPLICATIONS_PATH, "error", "That application was already reviewed."));

  if (application.desiredCourseId) {
    const desiredCourse = await prisma.course.findUnique({
      where: { id: application.desiredCourseId },
      select: { isActive: true },
    });
    if (!desiredCourse?.isActive) {
      redirect(flashUrl(APPLICATIONS_PATH, "error", "That course is archived. Restore it before approving into it."));
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: { name: application.name, email: application.email, phone: application.phone, rollNumber },
      });
      if (application.desiredCourseId) {
        const batch = await tx.courseBatch.upsert({
          where: { courseId_name: { courseId: application.desiredCourseId, name: DEFAULT_BATCH_NAME } },
          create: { courseId: application.desiredCourseId, name: DEFAULT_BATCH_NAME },
          update: {},
        });
        await enrollStudentInBatch(student.id, batch.id, tx);
      }
      await tx.studentApplication.update({
        where: { id: applicationId },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id },
      });
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(APPLICATIONS_PATH, "error", "That roll number or email is already in use."));
    }
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(APPLICATIONS_PATH, "success", `${application.name} was approved.`));
}

export async function rejectApplication(applicationId: string) {
  const session = await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  await prisma.studentApplication.update({
    where: { id: applicationId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: session.user.id },
  });

  revalidatePath(PATH);
  redirect(flashUrl(APPLICATIONS_PATH, "success", "Application rejected."));
}
