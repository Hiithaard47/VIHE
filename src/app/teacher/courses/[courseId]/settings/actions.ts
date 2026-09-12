"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const detailsSchema = z.object({
  name: z.string().min(1, "Course name is required."),
  code: z.string().min(1, "Course code is required."),
  description: z.string().optional(),
});

export async function updateCourseDetails(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/settings`;

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  try {
    await prisma.course.update({ where: { id: courseId }, data: parsed.data });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(path, "error", "That course code is already in use."));
    }
    throw err;
  }

  revalidatePath(path);
  revalidatePath(`/teacher/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Course details saved."));
}
