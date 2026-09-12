"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCourseConfigure, requireBatchConfigure } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import { enrollStudentInBatch, resolveBatchForCourse, unenrollStudentFromBatch } from "@/lib/enrollment";
import { PERMISSIONS } from "@/lib/permissions";

const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });

export async function enrollStudent(courseId: string, formData: FormData) {
  const session = await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/roster`;

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }
  const batchId = await resolveBatchForCourse(courseId, session.user.id, session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE));
  if (!batchId) redirect(flashUrl(path, "error", "No batch is available."));
  await requireBatchConfigure(batchId);

  await enrollStudentInBatch(parsed.data.studentId, batchId);

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student enrolled."));
}

export async function unenrollStudent(courseId: string, formData: FormData) {
  const session = await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/roster`;

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }
  const batchId = await resolveBatchForCourse(courseId, session.user.id, session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE));
  if (!batchId) redirect(flashUrl(path, "error", "No batch is available."));
  await requireBatchConfigure(batchId);

  // Attendance records are left intact: removing someone from the roster
  // must not rewrite the history of sessions they actually attended.
  //
  // deleteMany, not delete: `delete` throws P2025 when the row is already
  // gone — a double-click, or two people removing the same student — which
  // would surface as a 500. deleteMany treats that as a zero-row no-op, and
  // the end state the teacher wanted already holds either way.
  await unenrollStudentFromBatch(parsed.data.studentId, batchId);

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student removed from this course."));
}
