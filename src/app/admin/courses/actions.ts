"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const PATH = "/admin/courses";

const createCourseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  teacherIds: z.array(z.string()).default([]),
});

export async function createCourse(formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);

  const parsed = createCourseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
    teacherIds: formData.getAll("teacherIds"),
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, code, description, teacherIds } = parsed.data;

  try {
    await prisma.course.create({
      data: {
        name,
        code,
        description,
        teachers: { create: teacherIds.map((teacherId) => ({ teacherId })) },
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "That course code is already in use."));
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${name} was created.`));
}

export async function updateCourseTeachers(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);

  const teacherIds = formData.getAll("teacherIds").map(String);

  await prisma.$transaction([
    prisma.courseTeacher.deleteMany({ where: { courseId } }),
    prisma.courseTeacher.createMany({ data: teacherIds.map((teacherId) => ({ courseId, teacherId })) }),
  ]);

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Teachers updated."));
}

export async function toggleCourseActive(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);

  const nextActive = formData.get("nextActive") === "true";
  await prisma.course.update({ where: { id: courseId }, data: { isActive: nextActive } });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", nextActive ? "Course restored." : "Course archived."));
}
