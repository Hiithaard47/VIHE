"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent, requireSubjectAccess } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import {
  courseHref,
  parseCoursePortal,
  safeWorkspaceReturnTo,
  sessionHref,
  type CoursePortal,
} from "@/lib/course-workspace";
import { assignHomework, assignHomeworkForCourse, findSessionRef, removeHomework } from "./service/assign";
import { submitHomework } from "./service/submit";
import { isHomeworkError } from "./service/errors";
import { collectFormFiles } from "@/lib/assignment-files";

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

function fail(path: string, error: unknown): never {
  if (isHomeworkError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
}

export async function assignSessionHomework(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const classSession = await findSessionRef(sessionId);
  const fallback = sessionHref(portal, sessionId);
  if (!classSession) redirect(flashUrl(fallback, "error", "That session was not found."));

  const path = homeworkReturnPath(portal, classSession, formData);
  const actor = await requireSubjectAccess(classSession.subjectId, portal);

  try {
    const result = await assignHomework({
      sessionId,
      title: String(formData.get("title") ?? ""),
      instructions: String(formData.get("instructions") ?? "").trim() || null,
      actor,
    });
    revalidatePath(path);
    revalidatePath(sessionHref(portal, sessionId));
    revalidatePath(courseHref(portal, result.courseId, "homework", result.subjectId));
    redirect(flashUrl(path, "success", "Homework assigned for this session."));
  } catch (error) {
    fail(path, error);
  }
}

export async function assignCourseHomework(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const listFallback = courseHref(portal, courseId, "homework");
  if (!sessionId) redirect(flashUrl(listFallback, "error", "Choose a session."));

  const classSession = await findSessionRef(sessionId);
  if (!classSession || classSession.subject.courseId !== courseId) {
    redirect(flashUrl(listFallback, "error", "That session was not found."));
  }

  if (!String(formData.get("returnTo") ?? "").trim()) {
    formData.set("returnTo", courseHref(portal, courseId, "homework", classSession.subjectId));
  }

  const path = homeworkReturnPath(portal, classSession, formData);
  const actor = await requireSubjectAccess(classSession.subjectId, portal);

  try {
    const result = await assignHomeworkForCourse({
      courseId,
      sessionId,
      title: String(formData.get("title") ?? ""),
      instructions: String(formData.get("instructions") ?? "").trim() || null,
      actor,
    });
    revalidatePath(path);
    revalidatePath(sessionHref(portal, sessionId));
    revalidatePath(courseHref(portal, result.courseId, "homework", result.subjectId));
    redirect(flashUrl(path, "success", "Homework assigned for this session."));
  } catch (error) {
    fail(path, error);
  }
}

export async function removeSessionHomework(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const classSession = await findSessionRef(sessionId);
  const fallback = sessionHref(portal, sessionId);
  if (!classSession) redirect(flashUrl(fallback, "error", "That session was not found."));

  const path = homeworkReturnPath(portal, classSession, formData);
  const actor = await requireSubjectAccess(classSession.subjectId, portal);

  try {
    const result = await removeHomework({ sessionId, actor });
    revalidatePath(path);
    revalidatePath(sessionHref(portal, sessionId));
    revalidatePath(courseHref(portal, result.courseId, "homework", result.subjectId));
    redirect(flashUrl(path, "success", "Homework removed."));
  } catch (error) {
    fail(path, error);
  }
}

export async function submitSessionHomework(courseId: string, sessionId: string, formData: FormData) {
  const path = `/student/courses/${courseId}/sessions/${sessionId}`;
  const actor = await requireStudent();

  try {
    const result = await submitHomework({
      courseId,
      sessionId,
      actor,
      files: collectFormFiles(formData),
    });
    revalidatePath(path);
    revalidatePath(`/student/courses/${courseId}`);
    redirect(flashUrl(path, "success", result.updated ? "Homework updated." : "Homework submitted."));
  } catch (error) {
    if (isHomeworkError(error)) {
      if (error.code === "not_enrolled") redirect("/student");
      redirect(flashUrl(path, "error", error.message));
    }
    throw error;
  }
}
