"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageCourse, requireCourseAccess } from "@/lib/rbac";
import { assertWritableSubject } from "@/lib/subject-scope";
import { courseHref, parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";
import { hasWorkspaceWrite } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { parseDateInput } from "@/lib/time";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import {
  collectFormFiles,
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";

function assignmentsPath(courseId: string, portal: CoursePortal, subjectId?: string | null) {
  return courseHref(portal, courseId, "assignments", subjectId ?? undefined);
}

async function requireAssignmentManage(courseId: string, portalArg: CoursePortal) {
  const portal = parseCoursePortal(portalArg);
  const session = await requireCourseAccess(courseId, portal);
  if (!(await canManageCourse(session, courseId)) || !hasWorkspaceWrite(session.user.permissions)) {
    redirect(flashUrl(assignmentsPath(courseId, portal), "error", "You cannot manage assignments for this course."));
  }
  return { session, portal };
}

export async function createAssignment(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const { session, portal } = await requireAssignmentManage(courseId, portalArg);
  const requestedSubjectId = String(formData.get("subjectId") ?? "") || null;
  const subjectId = await assertWritableSubject(session, courseId, requestedSubjectId);
  const path = assignmentsPath(courseId, portal, subjectId ?? requestedSubjectId);
  if (!subjectId) redirect(flashUrl(path, "error", "You are not assigned to that subject."));

  const title = String(formData.get("title") ?? "").trim();
  if (!title) redirect(flashUrl(path, "error", "Title is required."));
  const maxMarks = Number.parseInt(String(formData.get("maxMarks") ?? ""), 10);
  if (!Number.isFinite(maxMarks) || maxMarks < 1) {
    redirect(flashUrl(path, "error", "Maximum marks must be at least 1."));
  }
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const dueDate = dueRaw ? parseDateInput(dueRaw) : null;
  if (dueRaw && !dueDate) redirect(flashUrl(path, "error", "Pick a valid due date."));
  const instructions = String(formData.get("instructions") ?? "").trim() || null;

  const files = collectFormFiles(formData);
  const invalid = validateAssignmentUploads(files);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!isStorageConfigured()) redirect(flashUrl(path, "error", "File storage is not configured."));

  const uploads = prepareUploadedFiles(files);
  const assignment = await prisma.assignment.create({
    data: {
      subjectId,
      title,
      instructions,
      dueDate,
      maxMarks,
      createdById: session.user.id,
    },
  });

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) => `assignments/${assignment.id}/prompt/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    await prisma.assignment.delete({ where: { id: assignment.id } }).catch(() => {});
    redirect(flashUrl(path, "error", error));
  }

  await prisma.assignmentFile.createMany({
    data: uploads.map((upload, index) => ({
      id: fileIds[index],
      assignmentId: assignment.id,
      fileName: upload.fileName,
      contentType: upload.file.type,
      sizeBytes: upload.file.size,
      storageKey: storedKeys[index],
    })),
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", `${title} was issued.`));
}

export async function gradeSubmission(courseId: string, assignmentId: string, studentId: string, portalArg: CoursePortal, formData: FormData) {
  const { session, portal } = await requireAssignmentManage(courseId, portalArg);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    select: { id: true, maxMarks: true, subjectId: true },
  });
  const path = courseHref(portal, courseId, `assignments/${assignmentId}`, assignment?.subjectId);
  if (!assignment) redirect(flashUrl(assignmentsPath(courseId, portal), "error", "That assignment was not found."));

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const submission = submissionId
    ? await prisma.assignmentSubmission.findFirst({
        where: { id: submissionId, assignmentId, studentId },
        select: { id: true, attemptNumber: true },
      })
    : await prisma.assignmentSubmission.findFirst({
        where: { assignmentId, studentId },
        orderBy: { attemptNumber: "desc" },
        select: { id: true, attemptNumber: true },
      });
  if (!submission) redirect(flashUrl(path, "error", "This student has not submitted yet."));

  const marks = Number.parseInt(String(formData.get("marks") ?? ""), 10);
  if (!Number.isFinite(marks) || marks < 0 || marks > assignment.maxMarks) {
    redirect(flashUrl(path, "error", `Marks must be between 0 and ${assignment.maxMarks}.`));
  }
  const feedback = String(formData.get("feedback") ?? "").trim() || null;

  await prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: { marks, feedback, gradedAt: new Date(), gradedById: session.user.id },
  });

  revalidatePath(path);
  redirect(
    flashUrl(
      path,
      "success",
      submission.attemptNumber > 1 ? `Marks saved for attempt ${submission.attemptNumber}.` : "Marks saved.",
    ),
  );
}

export async function deleteAssignment(courseId: string, assignmentId: string, portalArg: CoursePortal, _formData: FormData) {
  const { portal } = await requireAssignmentManage(courseId, portalArg);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    include: {
      files: { select: { storageKey: true } },
      submissions: { include: { files: { select: { storageKey: true } } } },
    },
  });
  const path = assignmentsPath(courseId, portal, assignment?.subjectId);
  if (!assignment) redirect(flashUrl(path, "error", "That assignment was not found."));

  if (isStorageConfigured()) {
    for (const file of assignment.files) {
      await deleteObject(file.storageKey).catch(() => {});
    }
    for (const submission of assignment.submissions) {
      for (const file of submission.files) {
        await deleteObject(file.storageKey).catch(() => {});
      }
    }
  }
  await prisma.assignment.delete({ where: { id: assignment.id } });
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Assignment removed."));
}
