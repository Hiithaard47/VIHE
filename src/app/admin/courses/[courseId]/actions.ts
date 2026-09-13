"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

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

