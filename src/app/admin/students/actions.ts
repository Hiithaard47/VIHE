"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const PATH = "/admin/students";

const createStudentSchema = z.object({
  name: z.string().min(1),
  rollNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  courseIds: z.array(z.string()).default([]),
});

export async function createStudent(formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  const parsed = createStudentSchema.safeParse({
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber"),
    email: formData.get("email") || "",
    courseIds: formData.getAll("courseIds"),
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, rollNumber, email, courseIds } = parsed.data;

  try {
    await prisma.student.create({
      data: {
        name,
        rollNumber,
        email: email || undefined,
        enrollments: { create: courseIds.map((courseId) => ({ courseId })) },
      },
    });
  } catch (err) {
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

  const courseIds = formData.getAll("courseIds").map(String);

  await prisma.$transaction([
    prisma.courseEnrollment.deleteMany({ where: { studentId } }),
    prisma.courseEnrollment.createMany({ data: courseIds.map((courseId) => ({ courseId, studentId })) }),
  ]);

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
        await tx.courseEnrollment.create({
          data: { studentId: student.id, courseId: application.desiredCourseId },
        });
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
