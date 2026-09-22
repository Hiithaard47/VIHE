"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashUrl, isForeignKeyError, isUniqueConstraintError } from "@/lib/flash";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActiveCourse, requirePermission, ARCHIVED_COURSE_MESSAGE } from "@/lib/rbac";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import {
  findSubjectWithCourse,
  createSubjectForCourse,
  updateSubjectName,
  toggleSubjectActive as toggleSubjectActiveDb,
  deleteSubjectById,
  countSubjectsForCourse,
  countAttendanceForSubject,
  loadSubjectForDeletion,
  addTeacherToSubject,
  removeTeacherFromSubject,
  findActiveTeacher,
} from "./db/repository";

const subjectSchema = z.object({ name: z.string().trim().min(1, "Subject name is required.") });
const teacherSchema = z.object({ teacherId: z.string().min(1, "Pick a teacher.") });

async function requireSubject(courseId: string, subjectId: string) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const subject = await findSubjectWithCourse(courseId, subjectId);
  if (!subject || subject.courseId !== courseId) redirect(`/admin/courses/${courseId}`);
  if (!subject.course.isActive) {
    redirect(flashUrl(`/admin/courses/${courseId}/subjects/${subjectId}`, "error", ARCHIVED_COURSE_MESSAGE));
  }
  return subject;
}

const subjectPath = (courseId: string, subjectId: string, tab = "") =>
  `/admin/courses/${courseId}/subjects/${subjectId}${tab ? `/${tab}` : ""}`;

export async function createSubject(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `/admin/courses/${courseId}`;
  await requireActiveCourse(courseId, path);
  const parsed = subjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid subject"));

  try {
    const subject = await createSubjectForCourse(courseId, parsed.data.name);
    revalidatePath(path);
    redirect(flashUrl(path, "success", `${subject.name} was created.`));
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That subject name is already in use."));
    throw err;
  }
}

export async function updateSubjectDetails(courseId: string, subjectId: string, formData: FormData) {
  await requireSubject(courseId, subjectId);
  const path = subjectPath(courseId, subjectId);
  const parsed = subjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await updateSubjectName(subjectId, parsed.data.name);
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That subject name is already in use."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Subject details saved."));
}

export async function toggleSubjectActive(courseId: string, subjectId: string, formData: FormData) {
  await requireSubject(courseId, subjectId);
  const nextActive = formData.get("nextActive") === "true";
  const path = subjectPath(courseId, subjectId);
  await toggleSubjectActiveDb(subjectId, nextActive);
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", nextActive ? "Subject restored." : "Subject archived."));
}

export async function deleteSubject(courseId: string, subjectId: string) {
  await requireSubject(courseId, subjectId);
  const path = subjectPath(courseId, subjectId);
  const coursePath = `/admin/courses/${courseId}`;

  const [subjectCount, attendanceCount, subject] = await Promise.all([
    countSubjectsForCourse(courseId),
    countAttendanceForSubject(subjectId),
    loadSubjectForDeletion(subjectId),
  ]);

  if (subjectCount <= 1) {
    redirect(flashUrl(path, "error", "A course needs at least one subject."));
  }
  if (attendanceCount > 0) {
    redirect(
      flashUrl(path, "error", "Cannot delete a subject that has attendance. Archive it instead."),
    );
  }

  // Collect storage keys before DB deletion
  const storageKeys: string[] = [];
  if (isStorageConfigured()) {
    for (const session of subject.sessions) {
      for (const resource of session.resources) {
        storageKeys.push(resource.storageKey);
      }
    }
    for (const assignment of subject.assignments) {
      for (const file of assignment.files) {
        storageKeys.push(file.storageKey);
      }
      for (const submission of assignment.submissions) {
        for (const file of submission.files) {
          storageKeys.push(file.storageKey);
        }
      }
    }
  }

  // BUG FIX: DB delete first, then storage cleanup
  await deleteSubjectById(subjectId);
  for (const key of storageKeys) {
    await deleteObject(key).catch(() => {});
  }
  revalidatePath(coursePath);
  redirect(flashUrl(coursePath, "success", `${subject.name} was deleted.`));
}

export async function addSubjectTeacher(courseId: string, subjectId: string, formData: FormData) {
  await requireSubject(courseId, subjectId);
  const path = subjectPath(courseId, subjectId, "teachers");
  const parsed = teacherSchema.safeParse({ teacherId: formData.get("teacherId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  const teacher = await findActiveTeacher(parsed.data.teacherId);
  if (!teacher) redirect(flashUrl(path, "error", "That teacher is no longer available."));

  try {
    await addTeacherToSubject(subjectId, teacher.id);
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That teacher is already assigned."));
    if (isForeignKeyError(err)) redirect(flashUrl(path, "error", "That teacher is no longer available."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", `${teacher.name} was assigned.`));
}

export async function removeSubjectTeacher(courseId: string, subjectId: string, formData: FormData) {
  await requireSubject(courseId, subjectId);
  const path = subjectPath(courseId, subjectId, "teachers");
  const parsed = teacherSchema.safeParse({ teacherId: formData.get("teacherId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  await removeTeacherFromSubject(subjectId, parsed.data.teacherId);
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Teacher removed."));
}
