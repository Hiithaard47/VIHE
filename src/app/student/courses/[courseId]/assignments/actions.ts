"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import { isStorageConfigured } from "@/lib/storage";
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

  const attempts = await prisma.assignmentSubmission.findMany({
    where: { assignmentId, studentId: session.user.id },
    orderBy: { attemptNumber: "desc" },
    select: { id: true, attemptNumber: true, marks: true },
  });
  const latest = attempts[0] ?? null;
  const latestGraded = latest?.marks !== null && latest?.marks !== undefined;
  const pastDue = isPastDueDate(assignment.dueDate);

  if (latest && !latestGraded && pastDue) {
    redirect(flashUrl(path, "error", "You cannot replace your upload after the due date until it is graded."));
  }

  const files = collectFormFiles(formData);
  const invalid = validateAssignmentUploads(files);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!isStorageConfigured()) redirect(flashUrl(path, "error", "File storage is not configured."));

  const uploads = prepareUploadedFiles(files);
  const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
  const submission = await prisma.assignmentSubmission.create({
    data: {
      assignmentId,
      studentId: session.user.id,
      attemptNumber,
    },
  });

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) => `assignments/${assignmentId}/submissions/${submission.id}/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    await prisma.assignmentSubmission.delete({ where: { id: submission.id } }).catch(() => {});
    redirect(flashUrl(path, "error", error));
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
  redirect(
    flashUrl(
      path,
      "success",
      attemptNumber === 1 ? "Assignment submitted." : `Attempt ${attemptNumber} submitted.`,
    ),
  );
}
