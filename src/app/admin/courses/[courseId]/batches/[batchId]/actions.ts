"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashUrl, isForeignKeyError, isUniqueConstraintError } from "@/lib/flash";
import { enrollStudentInBatch, unenrollStudentFromBatch } from "@/lib/enrollment";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ARCHIVED_COURSE_MESSAGE, requirePermission } from "@/lib/rbac";

const batchSchema = z.object({ name: z.string().trim().min(1, "Batch name is required.") });
const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });
const teacherSchema = z.object({ teacherId: z.string().min(1, "Pick a teacher.") });

async function requireBatch(courseId: string, batchId: string) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: { id: true, courseId: true, course: { select: { isActive: true } } },
  });
  if (!batch || batch.courseId !== courseId) redirect(`/admin/courses/${courseId}`);
  if (!batch.course.isActive) {
    redirect(flashUrl(`/admin/courses/${courseId}/batches/${batchId}`, "error", ARCHIVED_COURSE_MESSAGE));
  }
  return batch;
}

const batchPath = (courseId: string, batchId: string, tab = "") =>
  `/admin/courses/${courseId}/batches/${batchId}${tab ? `/${tab}` : ""}`;

export async function updateBatchDetails(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId);
  const parsed = batchSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.courseBatch.update({ where: { id: batchId }, data: { name: parsed.data.name } });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That batch name is already in use."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Batch details saved."));
}

export async function toggleBatchActive(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const nextActive = formData.get("nextActive") === "true";
  const path = batchPath(courseId, batchId);
  await prisma.courseBatch.update({ where: { id: batchId }, data: { isActive: nextActive } });
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", nextActive ? "Batch restored." : "Batch archived."));
}

export async function addBatchTeacher(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId, "teachers");
  const parsed = teacherSchema.safeParse({ teacherId: formData.get("teacherId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  const teacher = await prisma.user.findFirst({
    where: { id: parsed.data.teacherId, isActive: true },
    select: { id: true, name: true },
  });
  if (!teacher) redirect(flashUrl(path, "error", "That teacher is no longer available."));

  try {
    await prisma.batchTeacher.create({ data: { batchId, teacherId: teacher.id } });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That teacher is already assigned."));
    if (isForeignKeyError(err)) redirect(flashUrl(path, "error", "That teacher is no longer available."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", `${teacher.name} was assigned.`));
}

export async function removeBatchTeacher(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId, "teachers");
  const parsed = teacherSchema.safeParse({ teacherId: formData.get("teacherId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  await prisma.batchTeacher.deleteMany({ where: { batchId, teacherId: parsed.data.teacherId } });
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Teacher removed."));
}

export async function enrollBatchStudent(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId, "students");
  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  try {
    await enrollStudentInBatch(parsed.data.studentId, batchId);
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That student is already enrolled."));
    if (isForeignKeyError(err)) redirect(flashUrl(path, "error", "That student is no longer available."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Student enrolled."));
}

export async function unenrollBatchStudent(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId, "students");
  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  await unenrollStudentFromBatch(parsed.data.studentId, batchId);
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Student removed."));
}
