"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });

export async function enrollStudent(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/roster`;

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  try {
    await prisma.courseEnrollment.create({
      data: { courseId, studentId: parsed.data.studentId },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(path, "error", "That student is already enrolled."));
    }
    throw err;
  }

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student enrolled."));
}

export async function unenrollStudent(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/roster`;

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  // Attendance records are left intact: removing someone from the roster
  // must not rewrite the history of sessions they actually attended.
  await prisma.courseEnrollment.delete({
    where: { courseId_studentId: { courseId, studentId: parsed.data.studentId } },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student removed from this course."));
}
