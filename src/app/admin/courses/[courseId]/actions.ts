"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { parsePolicyForm } from "@/lib/policy";
import { parseLoginMonthsInput } from "@/lib/student-login";

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Course name is required."),
  code: z.string().trim().min(1, "Course code is required."),
  description: z.string(),
  loginMonths: z
    .string()
    .transform((value, ctx) => {
      const months = parseLoginMonthsInput(value);
      if (months === undefined) {
        ctx.addIssue({ code: "custom", message: "Pick a student login length." });
        return z.NEVER;
      }
      return months;
    }),
});

const batchSchema = z.object({ name: z.string().trim().min(1, "Batch name is required.") });

export async function createBatch(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `/admin/courses/${courseId}`;
  await requireActiveCourse(courseId, path);
  const parsed = batchSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid batch"));

  try {
    const batch = await prisma.courseBatch.create({ data: { courseId, name: parsed.data.name } });
    revalidatePath(path);
    redirect(flashUrl(path, "success", `${batch.name} was created.`));
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That batch name is already in use."));
    throw err;
  }
}

export async function updateCourseDetails(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `/admin/courses/${courseId}/details`;
  await requireActiveCourse(courseId, path);
  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") ?? "",
    loginMonths: String(formData.get("loginMonths") ?? ""),
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.course.update({
      where: { id: courseId },
      data: { ...parsed.data, description: parsed.data.description.trim() || null },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That course code is already in use."));
    throw err;
  }
  revalidatePath(path);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  redirect(flashUrl(path, "success", "Course details saved."));
}

export async function updateCoursePolicy(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `/admin/courses/${courseId}/policy`;
  await requireActiveCourse(courseId, path);
  const parsed = parsePolicyForm(formData);
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid policy"));
  await prisma.course.update({ where: { id: courseId }, data: parsed.data });
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Attendance policy saved."));
}

