"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageSubject, requireSubjectAccess, requireStudent } from "@/lib/rbac";
import { hasWorkspaceWrite } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import {
  collectFormFiles,
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { sessionTiming } from "@/lib/time";
import { parseCoursePortal, courseHref, safeWorkspaceReturnTo, sessionHref, type CoursePortal } from "@/lib/course-workspace";

async function requireHomeworkManage(sessionId: string, portalArg: CoursePortal) {
  const portal = parseCoursePortal(portalArg);
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      subjectId: true,
      subject: { select: { courseId: true } },
      homework: { select: { id: true } },
    },
  });
  if (!classSession) redirect(flashUrl(sessionHref(portal, sessionId), "error", "That session was not found."));
  const session = await requireSubjectAccess(classSession.subjectId, portal);
  if (!(await canManageSubject(session, classSession.subjectId)) || !hasWorkspaceWrite(session.user.permissions)) {
    redirect(flashUrl(sessionHref(portal, sessionId), "error", "You cannot manage homework for this session."));
  }
  return { portal, classSession, session };
}

function homeworkReturnPath(
  portal: CoursePortal,
  classSession: { id: string; subjectId: string; subject: { courseId: string } },
  formData: FormData,
) {
  const list = courseHref(portal, classSession.subject.courseId, "homework", classSession.subjectId);
  const fallback = sessionHref(portal, classSession.id);
  const raw = formData.get("returnTo");
  if (typeof raw === "string" && raw.trim()) {
    return safeWorkspaceReturnTo(raw, list);
  }
  return fallback;
}

export async function assignSessionHomework(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const { portal, classSession, session } = await requireHomeworkManage(sessionId, portalArg);
  const path = homeworkReturnPath(portal, classSession, formData);
  if (classSession.homework) redirect(flashUrl(path, "error", "This session already has homework."));

  const title = String(formData.get("title") ?? "").trim();
  if (!title) redirect(flashUrl(path, "error", "Title is required."));
  const instructions = String(formData.get("instructions") ?? "").trim() || null;

  await prisma.sessionHomework.create({
    data: {
      sessionId,
      title,
      instructions,
      createdById: session.user.id,
    },
  });

  revalidatePath(path);
  revalidatePath(sessionHref(portal, sessionId));
  revalidatePath(courseHref(portal, classSession.subject.courseId, "homework", classSession.subjectId));
  redirect(flashUrl(path, "success", "Homework assigned for this session."));
}

export async function assignCourseHomework(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const listFallback = courseHref(portal, courseId, "homework");
  if (!sessionId) redirect(flashUrl(listFallback, "error", "Choose a session."));

  const classSession = await prisma.classSession.findFirst({
    where: { id: sessionId, subject: { courseId } },
    select: { id: true, subjectId: true },
  });
  if (!classSession) redirect(flashUrl(listFallback, "error", "That session was not found."));

  if (!String(formData.get("returnTo") ?? "").trim()) {
    formData.set("returnTo", courseHref(portal, courseId, "homework", classSession.subjectId));
  }
  await assignSessionHomework(sessionId, portal, formData);
}

export async function removeSessionHomework(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const { portal, classSession } = await requireHomeworkManage(sessionId, portalArg);
  const path = homeworkReturnPath(portal, classSession, formData);
  if (!classSession.homework) redirect(flashUrl(path, "error", "This session has no homework."));

  const homework = await prisma.sessionHomework.findUnique({
    where: { id: classSession.homework.id },
    include: { submissions: { include: { files: { select: { storageKey: true } } } } },
  });
  if (!homework) redirect(flashUrl(path, "error", "This session has no homework."));

  if (isStorageConfigured()) {
    for (const submission of homework.submissions) {
      for (const file of submission.files) {
        await deleteObject(file.storageKey).catch(() => {});
      }
    }
  }
  await prisma.sessionHomework.delete({ where: { id: homework.id } });
  revalidatePath(path);
  revalidatePath(sessionHref(portal, sessionId));
  revalidatePath(courseHref(portal, classSession.subject.courseId, "homework", classSession.subjectId));
  redirect(flashUrl(path, "success", "Homework removed."));
}

export async function submitSessionHomework(courseId: string, sessionId: string, formData: FormData) {
  const auth = await requireStudent();
  const path = `/student/courses/${courseId}/sessions/${sessionId}`;
  const enrollment = await findStudentCourseEnrollment(auth.user.id, courseId);
  if (!enrollment) redirect("/student");
  if (!enrollment.course.isActive) {
    redirect(flashUrl(path, "error", "This course is completed. You cannot submit."));
  }

  const classSession = await prisma.classSession.findFirst({
    where: { id: sessionId, subject: { courseId } },
    select: {
      id: true,
      date: true,
      homework: { select: { id: true } },
    },
  });
  if (!classSession?.homework) redirect(flashUrl(path, "error", "This session has no homework."));
  if (sessionTiming(classSession.date) !== "today") {
    redirect(flashUrl(path, "error", "Homework can only be submitted on the session day."));
  }

  const files = collectFormFiles(formData);
  const invalid = validateAssignmentUploads(files);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!isStorageConfigured()) redirect(flashUrl(path, "error", "File storage is not configured."));

  const uploads = prepareUploadedFiles(files);
  const existing = await prisma.sessionHomeworkSubmission.findUnique({
    where: {
      homeworkId_studentId: { homeworkId: classSession.homework.id, studentId: auth.user.id },
    },
    include: { files: { select: { storageKey: true } } },
  });

  const submission = existing
    ? await prisma.sessionHomeworkSubmission.update({
        where: { id: existing.id },
        data: { submittedAt: new Date() },
      })
    : await prisma.sessionHomeworkSubmission.create({
        data: {
          homeworkId: classSession.homework.id,
          studentId: auth.user.id,
        },
      });

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) =>
      `sessions/${sessionId}/homework/${submission.id}/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    if (!existing) await prisma.sessionHomeworkSubmission.delete({ where: { id: submission.id } }).catch(() => {});
    redirect(flashUrl(path, "error", error));
  }

  if (existing) {
    await prisma.sessionHomeworkSubmissionFile.deleteMany({ where: { submissionId: existing.id } });
    if (isStorageConfigured()) {
      for (const file of existing.files) {
        await deleteObject(file.storageKey).catch(() => {});
      }
    }
  }

  await prisma.sessionHomeworkSubmissionFile.createMany({
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
  revalidatePath(`/student/courses/${courseId}`);
  redirect(flashUrl(path, "success", existing ? "Homework updated." : "Homework submitted."));
}
