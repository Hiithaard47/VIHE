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

const PATH = "/admin/students";

const createStudentSchema = z.object({
  name: z.string().min(1),
  rollNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
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

async function validateBatchSelection(
  tx: Prisma.TransactionClient,
  studentId: string | undefined,
  courseId: string,
  batchId: string,
) {
  const batch = await tx.courseBatch.findUnique({
    where: { id: batchId },
    select: { id: true, courseId: true, isActive: true },
  });
  if (!batch || !isBatchAssignableToCourse(batch, courseId)) {
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
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, rollNumber, email } = parsed.data;
  const batchSelections = getBatchSelections(formData);

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          name,
          rollNumber,
          email: email || undefined,
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

export async function updateStudentEnrollments(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

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
  redirect(flashUrl(PATH, "success", "Enrollment updated."));
}

export async function toggleStudentActive(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  const nextActive = formData.get("nextActive") === "true";
  await prisma.student.update({ where: { id: studentId }, data: { isActive: nextActive } });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", nextActive ? "Student reactivated." : "Student deactivated."));
}

export async function approveApplication(applicationId: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  const rollNumber = String(formData.get("rollNumber") ?? "").trim();
  if (!rollNumber) redirect(flashUrl(PATH, "error", "A roll number is required to approve."));

  const application = await prisma.studentApplication.findUniqueOrThrow({ where: { id: applicationId } });
  if (application.status !== "PENDING") redirect(flashUrl(PATH, "error", "That application was already reviewed."));

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: { name: application.name, email: application.email, rollNumber },
      });
      if (application.desiredCourseId) {
        const batch = await tx.courseBatch.upsert({
          where: { courseId_name: { courseId: application.desiredCourseId, name: DEFAULT_BATCH_NAME } },
          create: { courseId: application.desiredCourseId, name: DEFAULT_BATCH_NAME },
          update: {},
        });
        await tx.batchEnrollment.create({ data: { studentId: student.id, batchId: batch.id } });
      }
      await tx.studentApplication.update({
        where: { id: applicationId },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id },
      });
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(PATH, "error", "That roll number or email is already in use."));
    }
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${application.name} was approved.`));
}

export async function rejectApplication(applicationId: string) {
  const session = await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  await prisma.studentApplication.update({
    where: { id: applicationId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: session.user.id },
  });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Application rejected."));
}
