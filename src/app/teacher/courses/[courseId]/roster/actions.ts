"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCourseConfigure, requireBatchConfigure } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import { enrollStudentInBatch, resolveWritableBatch, unenrollStudentFromBatch } from "@/lib/enrollment";
import { courseHref, parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";

const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });

export async function enrollStudent(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const session = await requireCourseConfigure(courseId, portal);
  const requestedBatchId = String(formData.get("batchId") ?? "") || null;
  const path = courseHref(portal, courseId, "roster", requestedBatchId ?? undefined);

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }
  const batchId = await resolveWritableBatch(courseId, session.user.id, requestedBatchId);
  if (!batchId) redirect(flashUrl(path, "error", "No batch is available."));
  await requireBatchConfigure(batchId, portal);

  await enrollStudentInBatch(parsed.data.studentId, batchId);

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student enrolled."));
}

export async function unenrollStudent(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const session = await requireCourseConfigure(courseId, portal);
  const requestedBatchId = String(formData.get("batchId") ?? "") || null;
  const path = courseHref(portal, courseId, "roster", requestedBatchId ?? undefined);

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }
  const batchId = await resolveWritableBatch(courseId, session.user.id, requestedBatchId);
  if (!batchId) redirect(flashUrl(path, "error", "No batch is available."));
  await requireBatchConfigure(batchId, portal);

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
