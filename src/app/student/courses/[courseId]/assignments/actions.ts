"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { sanitizeFileName, storeAssignmentFile, validateResourceFile } from "@/lib/assignment-files";
import { isPastDueDate } from "@/lib/time";

export async function submitAssignment(courseId: string, assignmentId: string, formData: FormData) {
  const session = await requireStudent();
  const path = `/student/courses/${courseId}/assignments/${assignmentId}`;
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) redirect("/student");
  if (!enrollment.batch.course.isActive) {
    redirect(flashUrl(path, "error", "This course is completed. You cannot submit."));
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, batchId: enrollment.batch.id },
    select: { id: true, dueDate: true },
  });
  if (!assignment) redirect(flashUrl(`/student/courses/${courseId}/assignments`, "error", "That assignment was not found."));

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: session.user.id } },
  });
  if (existing?.marks !== null && existing?.marks !== undefined) {
    redirect(flashUrl(path, "error", "This assignment has already been graded."));
  }
  if (existing && isPastDueDate(assignment.dueDate)) {
    redirect(flashUrl(path, "error", "You cannot replace your upload after the due date."));
  }

  const file = formData.get("file");
  if (!(file instanceof File)) redirect(flashUrl(path, "error", "Upload your completed assignment."));
  const invalid = validateResourceFile(file);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!isStorageConfigured()) redirect(flashUrl(path, "error", "File storage is not configured."));

  const fileName = sanitizeFileName(file.name);
  const pendingKey = `pending/${assignmentId}/${session.user.id}/${crypto.randomUUID()}`;
  const submission = existing
    ? await prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { fileName, contentType: file.type, sizeBytes: file.size, storageKey: pendingKey, submittedAt: new Date() },
      })
    : await prisma.assignmentSubmission.create({
        data: {
          assignmentId,
          studentId: session.user.id,
          fileName,
          contentType: file.type,
          sizeBytes: file.size,
          storageKey: pendingKey,
        },
      });

  const storageKey = `assignments/${assignmentId}/submissions/${submission.id}/${fileName}`;
  const stored = await storeAssignmentFile(storageKey, file);
  if (stored) {
    if (!existing) await prisma.assignmentSubmission.delete({ where: { id: submission.id } }).catch(() => {});
    else if (existing.storageKey !== pendingKey) {
      await prisma.assignmentSubmission.update({
        where: { id: submission.id },
        data: { storageKey: existing.storageKey, fileName: existing.fileName, contentType: existing.contentType, sizeBytes: existing.sizeBytes },
      });
    }
    redirect(flashUrl(path, "error", stored));
  }

  if (existing && isStorageConfigured() && existing.storageKey !== storageKey) {
    await deleteObject(existing.storageKey).catch(() => {});
  }
  await prisma.assignmentSubmission.update({ where: { id: submission.id }, data: { storageKey } });

  revalidatePath(path);
  revalidatePath(`/student/courses/${courseId}/assignments`);
  redirect(flashUrl(path, "success", "Assignment submitted."));
}
