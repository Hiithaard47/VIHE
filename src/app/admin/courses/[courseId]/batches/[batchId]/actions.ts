"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flashUrl, isForeignKeyError, isUniqueConstraintError } from "@/lib/flash";
import { enrollStudentInBatch, unenrollStudentFromBatch } from "@/lib/enrollment";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

const batchSchema = z.object({ name: z.string().trim().min(1, "Batch name is required.") });
const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });

async function requireBatch(courseId: string, batchId: string) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({ where: { id: batchId }, select: { id: true, courseId: true } });
  if (!batch || batch.courseId !== courseId) redirect(`/admin/courses/${courseId}`);
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
    await prisma.courseBatch.update({
      where: { id: batchId },
      data: { name: parsed.data.name, isActive: formData.get("nextActive") === "true" },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That batch name is already in use."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Batch details saved."));
}

export async function updateBatchTeachers(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId, "teachers");
  const teacherIds = formData.getAll("teacherIds").map(String);
  const activeTeachers = await prisma.user.findMany({
    where: { id: { in: teacherIds }, isActive: true },
    select: { id: true },
  });
  try {
    await prisma.$transaction([
      prisma.batchTeacher.deleteMany({ where: { batchId } }),
      prisma.batchTeacher.createMany({
        data: activeTeachers.map(({ id }) => ({ batchId, teacherId: id })),
      }),
    ]);
  } catch (err) {
    if (isForeignKeyError(err)) redirect(flashUrl(path, "error", "One of those teachers is no longer available."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Teachers saved."));
}

export async function enrollBatchStudent(courseId: string, batchId: string, formData: FormData) {
  await requireBatch(courseId, batchId);
  const path = batchPath(courseId, batchId, "roster");
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
  const path = batchPath(courseId, batchId, "roster");
  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  await unenrollStudentFromBatch(parsed.data.studentId, batchId);
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Student removed."));
}
