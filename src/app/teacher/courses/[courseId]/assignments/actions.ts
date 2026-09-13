"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageCourse, requireCourseAccess } from "@/lib/rbac";
import { assertWritableBatch } from "@/lib/batch-scope";
import { courseHref, parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";
import { hasWorkspaceWrite } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { parseDateInput } from "@/lib/time";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { sanitizeFileName, storeAssignmentFile, validateResourceFile } from "@/lib/assignment-files";

function assignmentsPath(courseId: string, portal: CoursePortal, batchId?: string | null) {
  return courseHref(portal, courseId, "assignments", batchId ?? undefined);
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
  const requestedBatchId = String(formData.get("batchId") ?? "") || null;
  const batchId = await assertWritableBatch(session, courseId, requestedBatchId);
  const path = assignmentsPath(courseId, portal, batchId ?? requestedBatchId);
  if (!batchId) redirect(flashUrl(path, "error", "You are not assigned to that batch."));

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

  const file = formData.get("file");
  if (!(file instanceof File)) redirect(flashUrl(path, "error", "Upload the assignment test."));
  const invalid = validateResourceFile(file);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!isStorageConfigured()) redirect(flashUrl(path, "error", "File storage is not configured."));

  const fileName = sanitizeFileName(file.name);
  const assignment = await prisma.assignment.create({
    data: {
      batchId,
      title,
      instructions,
      dueDate,
      maxMarks,
      fileName,
      contentType: file.type,
      sizeBytes: file.size,
      storageKey: `pending/${crypto.randomUUID()}`,
      createdById: session.user.id,
    },
  });
  const storageKey = `assignments/${assignment.id}/prompt/${fileName}`;
  const stored = await storeAssignmentFile(storageKey, file);
  if (stored) {
    await prisma.assignment.delete({ where: { id: assignment.id } }).catch(() => {});
    redirect(flashUrl(path, "error", stored));
  }
  await prisma.assignment.update({ where: { id: assignment.id }, data: { storageKey } });

  revalidatePath(path);
  redirect(flashUrl(path, "success", `${title} was issued.`));
}

export async function gradeSubmission(courseId: string, assignmentId: string, studentId: string, portalArg: CoursePortal, formData: FormData) {
  const { session, portal } = await requireAssignmentManage(courseId, portalArg);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, batch: { courseId } },
    select: { id: true, maxMarks: true, batchId: true },
  });
  const path = courseHref(portal, courseId, `assignments/${assignmentId}`, assignment?.batchId);
  if (!assignment) redirect(flashUrl(assignmentsPath(courseId, portal), "error", "That assignment was not found."));

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    select: { id: true },
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
  redirect(flashUrl(path, "success", "Marks saved."));
}

export async function deleteAssignment(courseId: string, assignmentId: string, portalArg: CoursePortal, formData: FormData) {
  const { portal } = await requireAssignmentManage(courseId, portalArg);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, batch: { courseId } },
    include: { submissions: { select: { storageKey: true } } },
  });
  const path = assignmentsPath(courseId, portal, assignment?.batchId);
  if (!assignment) redirect(flashUrl(path, "error", "That assignment was not found."));

  if (isStorageConfigured()) {
    await deleteObject(assignment.storageKey).catch(() => {});
    for (const submission of assignment.submissions) {
      await deleteObject(submission.storageKey).catch(() => {});
    }
  }
  await prisma.assignment.delete({ where: { id: assignment.id } });
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Assignment removed."));
}
