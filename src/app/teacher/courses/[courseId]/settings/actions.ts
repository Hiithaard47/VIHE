"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { parsePolicyForm } from "@/lib/policy";
import { parseLoginMonthsInput } from "@/lib/student-login";

const detailsSchema = z.object({
  name: z.string().min(1, "Course name is required."),
  code: z.string().min(1, "Course code is required."),
  // Always a string (the textarea always submits). Empty means "cleared",
  // which must reach the database as null — `undefined` would make Prisma
  // omit the column from the UPDATE and silently keep the old value.
  description: z.string(),
  loginMonths: z.string().transform((value, ctx) => {
    const months = parseLoginMonthsInput(value);
    if (months === undefined) {
      ctx.addIssue({ code: "custom", message: "Pick a student login length." });
      return z.NEVER;
    }
    return months;
  }),
});

export async function updateCourseDetails(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/settings`;

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") ?? "",
    loginMonths: String(formData.get("loginMonths") ?? ""),
  });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  try {
    await prisma.course.update({
      where: { id: courseId },
      data: { ...parsed.data, description: parsed.data.description.trim() || null },
    });
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

export async function updateCoursePolicy(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/settings`;

  const parsed = parsePolicyForm(formData);
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid policy"));
  }

  await prisma.course.update({ where: { id: courseId }, data: parsed.data });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Attendance policy saved."));
}
