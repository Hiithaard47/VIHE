"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import {
  collectFormFiles,
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { isPastDueDate } from "@/lib/time";

export async function submitAssignment(courseId: string, assignmentId: string, formData: FormData) {
  const session = await requireStudent();
  const path = `/student/courses/${courseId}/assignments/${assignmentId}`;
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) redirect("/student");
  if (!enrollment.course.isActive) {
    redirect(flashUrl(path, "error", "This course is completed. You cannot submit."));
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    select: { id: true, dueDate: true },
  });
  if (!assignment) redirect(flashUrl(`/student/courses/${courseId}/assignments`, "error", "That assignment was not found."));

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: session.user.id } },
    include: { files: { select: { id: true, storageKey: true } } },
  });
  if (existing?.marks !== null && existing?.marks !== undefined) {
    redirect(flashUrl(path, "error", "This assignment has already been graded."));
  }
  if (existing && isPastDueDate(assignment.dueDate)) {
    redirect(flashUrl(path, "error", "You cannot replace your upload after the due date."));
  }

  const files = collectFormFiles(formData);
  const invalid = validateAssignmentUploads(files);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!isStorageConfigured()) redirect(flashUrl(path, "error", "File storage is not configured."));

  const uploads = prepareUploadedFiles(files);
  const submission = existing
    ? await prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { submittedAt: new Date() },
      })
    : await prisma.assignmentSubmission.create({
        data: {
          assignmentId,
          studentId: session.user.id,
        },
      });

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) => `assignments/${assignmentId}/submissions/${submission.id}/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    if (!existing) await prisma.assignmentSubmission.delete({ where: { id: submission.id } }).catch(() => {});
    redirect(flashUrl(path, "error", error));
  }

  if (existing) {
    await prisma.assignmentSubmissionFile.deleteMany({ where: { submissionId: existing.id } });
    if (isStorageConfigured()) {
      for (const file of existing.files) {
        await deleteObject(file.storageKey).catch(() => {});
      }
    }
  }

  await prisma.assignmentSubmissionFile.createMany({
    data: uploads.map((upload, index) => ({
      id: fileIds[index],
      submissionId: submission.id,
      fileName: upload.fileName,
      contentType: upload.file.type,
      sizeBytes: upload.file.size,
      storageKey: storedKeys[index],
    })),
  });

  revalidatePath(path);
  revalidatePath(`/student/courses/${courseId}/assignments`);
  redirect(flashUrl(path, "success", "Assignment submitted."));
}
