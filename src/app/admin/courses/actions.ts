"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { DEFAULT_BATCH_NAME } from "@/lib/batches";

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
        batches: { create: { name: DEFAULT_BATCH_NAME } },
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "That course code is already in use."));
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${name} was created.`));
}
