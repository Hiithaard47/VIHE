"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { DEFAULT_SUBJECT_NAME } from "@/lib/subjects";
import { loginMonthsForCourseCode } from "@/lib/student-login";

const PATH = "/admin/courses";

const createCourseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

export async function createCourse(formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);

  const parsed = createCourseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, code, description } = parsed.data;

  try {
    await prisma.course.create({
      data: {
        name,
        code,
        description,
        loginMonths: loginMonthsForCourseCode(code),
        subjects: { create: { name: DEFAULT_SUBJECT_NAME } },
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "That course code is already in use."));
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${name} was created.`));
}

export async function toggleCourseActive(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const nextActive = formData.get("nextActive") === "true";
  const path = `/admin/courses/${courseId}`;
  await prisma.course.update({ where: { id: courseId }, data: { isActive: nextActive } });
  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Course restored." : "Course archived."));
}
