"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashUrl, isForeignKeyError, isUniqueConstraintError } from "@/lib/flash";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ARCHIVED_COURSE_MESSAGE, requirePermission } from "@/lib/rbac";

const subjectSchema = z.object({ name: z.string().trim().min(1, "Subject name is required.") });
const teacherSchema = z.object({ teacherId: z.string().min(1, "Pick a teacher.") });

async function requireSubject(courseId: string, subjectId: string) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const subject = await prisma.courseSubject.findUnique({
    where: { id: subjectId },
    select: { id: true, courseId: true, course: { select: { isActive: true } } },
  });
  if (!subject || subject.courseId !== courseId) redirect(`/admin/courses/${courseId}`);
  if (!subject.course.isActive) {
    redirect(flashUrl(`/admin/courses/${courseId}/subjects/${subjectId}`, "error", ARCHIVED_COURSE_MESSAGE));
  }
  return subject;
}

const subjectPath = (courseId: string, subjectId: string, tab = "") =>
  `/admin/courses/${courseId}/subjects/${subjectId}${tab ? `/${tab}` : ""}`;

export async function updateSubjectDetails(courseId: string, subjectId: string, formData: FormData) {
  await requireSubject(courseId, subjectId);
  const path = subjectPath(courseId, subjectId);
  const parsed = subjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.courseSubject.update({ where: { id: subjectId }, data: { name: parsed.data.name } });
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
  await prisma.courseSubject.update({ where: { id: subjectId }, data: { isActive: nextActive } });
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", nextActive ? "Subject restored." : "Subject archived."));
}

export async function addSubjectTeacher(courseId: string, subjectId: string, formData: FormData) {
  await requireSubject(courseId, subjectId);
  const path = subjectPath(courseId, subjectId, "teachers");
  const parsed = teacherSchema.safeParse({ teacherId: formData.get("teacherId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  const teacher = await prisma.user.findFirst({
    where: { id: parsed.data.teacherId, isActive: true },
    select: { id: true, name: true },
  });
  if (!teacher) redirect(flashUrl(path, "error", "That teacher is no longer available."));

  try {
    await prisma.subjectTeacher.create({ data: { subjectId, teacherId: teacher.id } });
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
  await prisma.subjectTeacher.deleteMany({ where: { subjectId, teacherId: parsed.data.teacherId } });
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Teacher removed."));
}

