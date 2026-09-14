"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const subjectSchema = z.object({ name: z.string().trim().min(1, "Subject name is required.") });

export async function createSubject(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `/admin/courses/${courseId}`;
  await requireActiveCourse(courseId, path);
  const parsed = subjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid subject"));

  try {
    const subject = await prisma.courseSubject.create({ data: { courseId, name: parsed.data.name } });
    revalidatePath(path);
    redirect(flashUrl(path, "success", `${subject.name} was created.`));
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "That subject name is already in use."));
    throw err;
  }
}

