"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl, isForeignKeyError, isUniqueConstraintError } from "@/lib/flash";

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
    // A stale dropdown or tampered form post can name a studentId that no
    // longer exists, which Prisma reports as a foreign-key violation rather
    // than the unique-constraint one above.
    if (isForeignKeyError(err)) {
      redirect(flashUrl(path, "error", "That student no longer exists."));
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
  //
  // deleteMany, not delete: `delete` throws P2025 when the row is already
  // gone — a double-click, or two people removing the same student — which
  // would surface as a 500. deleteMany treats that as a zero-row no-op, and
  // the end state the teacher wanted already holds either way.
  await prisma.courseEnrollment.deleteMany({
    where: { courseId, studentId: parsed.data.studentId },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student removed from this course."));
}
