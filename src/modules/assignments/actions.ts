"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCourseAccess, canManageCourse, requireStudent } from "@/lib/rbac";
import { hasWorkspaceWrite } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { courseHref, parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";
import { assertWritableSubject } from "@/lib/subject-scope";
import { collectFormFiles } from "@/lib/assignment-files";
import { isAssignmentError } from "./service/errors";
import {
  createAssignment as createAssignmentService,
  gradeSubmission as gradeSubmissionService,
  deleteAssignment as deleteAssignmentService,
} from "./service/manage";
import { findAssignmentSubjectId } from "./service/queries";
import { submitAssignment as submitAssignmentService } from "./service/submit";

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

function fail(path: string, error: unknown): never {
  if (isAssignmentError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
}

export async function createAssignment(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const { session, portal } = await requireAssignmentManage(courseId, portalArg);
  const requestedSubjectId = String(formData.get("subjectId") ?? "") || null;
  const subjectId = await assertWritableSubject(session, courseId, requestedSubjectId);
  const path = assignmentsPath(courseId, portal, subjectId ?? requestedSubjectId);
  if (!subjectId) redirect(flashUrl(path, "error", "You are not assigned to that subject."));

  try {
    const title = String(formData.get("title") ?? "").trim();
    await createAssignmentService({
      subjectId,
      title,
      instructions: String(formData.get("instructions") ?? "").trim() || null,
      dueRaw: String(formData.get("dueDate") ?? "").trim() || null,
      maxMarks: Number.parseInt(String(formData.get("maxMarks") ?? ""), 10),
      files: collectFormFiles(formData),
      actorId: session.user.id,
    });
    revalidatePath(path);
    redirect(flashUrl(path, "success", `${title || "Assignment"} was issued.`));
  } catch (error) {
    fail(path, error);
  }
}

export async function gradeSubmission(
  courseId: string,
  assignmentId: string,
  studentId: string,
  portalArg: CoursePortal,
  formData: FormData,
) {
  const { session, portal } = await requireAssignmentManage(courseId, portalArg);
  const submissionId = String(formData.get("submissionId") ?? "").trim() || null;
  const subjectId = await findAssignmentSubjectId(assignmentId, courseId);
  const listPath = assignmentsPath(courseId, portal, subjectId);
  const detailPath = courseHref(portal, courseId, `assignments/${assignmentId}`, subjectId ?? undefined);

  try {
    const result = await gradeSubmissionService({
      courseId,
      assignmentId,
      studentId,
      submissionId,
      marks: Number.parseInt(String(formData.get("marks") ?? ""), 10),
      feedback: String(formData.get("feedback") ?? "").trim() || null,
      actor: session,
    });
    const path = courseHref(portal, courseId, `assignments/${assignmentId}`, result.subjectId);
    revalidatePath(path);
    redirect(
      flashUrl(
        path,
        "success",
        result.attemptNumber > 1 ? `Marks saved for attempt ${result.attemptNumber}.` : "Marks saved.",
      ),
    );
  } catch (error) {
    if (isAssignmentError(error) && error.code === "not_found") fail(listPath, error);
    fail(detailPath, error);
  }
}

export async function deleteAssignment(
  courseId: string,
  assignmentId: string,
  portalArg: CoursePortal,
  _formData: FormData,
) {
  const { session, portal } = await requireAssignmentManage(courseId, portalArg);
  const subjectId = await findAssignmentSubjectId(assignmentId, courseId);
  const listPath = assignmentsPath(courseId, portal, subjectId);

  try {
    const result = await deleteAssignmentService({ courseId, assignmentId, actor: session });
    const path = assignmentsPath(courseId, portal, result.subjectId);
    revalidatePath(path);
    redirect(flashUrl(path, "success", "Assignment removed."));
  } catch (error) {
    fail(listPath, error);
  }
}

export async function submitAssignment(courseId: string, assignmentId: string, formData: FormData) {
  const path = `/student/courses/${courseId}/assignments/${assignmentId}`;
  const actor = await requireStudent();

  try {
    const result = await submitAssignmentService({
      courseId,
      assignmentId,
      actor,
      files: collectFormFiles(formData),
    });
    revalidatePath(path);
    revalidatePath(`/student/courses/${courseId}/assignments`);
    redirect(
      flashUrl(
        path,
        "success",
        result.attemptNumber === 1 ? "Assignment submitted." : `Attempt ${result.attemptNumber} submitted.`,
      ),
    );
  } catch (error) {
    if (isAssignmentError(error)) {
      if (error.code === "not_enrolled") redirect("/student");
      if (error.code === "not_found") {
        redirect(flashUrl(`/student/courses/${courseId}/assignments`, "error", error.message));
      }
      redirect(flashUrl(path, "error", error.message));
    }
    throw error;
  }
}
