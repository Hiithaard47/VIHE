"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { parseMinAttendancePercent } from "@/lib/session-categories";

const PATH = "/admin/session-categories";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  minAttendancePercent: z.string(),
});

const detailsSchema = createSchema;

function parseCategoryForm(formData: FormData, path: string) {
  const parsed = detailsSchema.safeParse({
    name: formData.get("name") ?? "",
    minAttendancePercent: String(formData.get("minAttendancePercent") ?? ""),
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const minAttendancePercent = parseMinAttendancePercent(parsed.data.minAttendancePercent);
  if (minAttendancePercent === undefined) {
    redirect(flashUrl(path, "error", "Minimum attendance must be between 0 and 100."));
  }
  return { name: parsed.data.name, minAttendancePercent };
}

export async function createSessionCategory(formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const data = parseCategoryForm(formData, PATH);

  try {
    const category = await prisma.sessionCategory.create({ data });
    revalidatePath(PATH);
    redirect(flashUrl(PATH, "success", `${category.name} was created.`));
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "A category with that name already exists."));
    throw err;
  }
}

export async function updateSessionCategory(categoryId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `${PATH}/${categoryId}`;
  const category = await prisma.sessionCategory.findUnique({
    where: { id: categoryId },
    select: { isActive: true, isSystem: true },
  });
  if (!category) redirect(PATH);
  if (!category.isActive) redirect(flashUrl(path, "error", "This category is archived. Restore to make changes."));

  const data = parseCategoryForm(formData, path);

  try {
    await prisma.sessionCategory.update({
      where: { id: categoryId },
      data: {
        name: category.isSystem ? undefined : data.name,
        minAttendancePercent: data.minAttendancePercent,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "A category with that name already exists."));
    throw err;
  }

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Category saved."));
}

export async function toggleSessionCategoryActive(categoryId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const path = `${PATH}/${categoryId}`;
  const category = await prisma.sessionCategory.findUnique({
    where: { id: categoryId },
    select: { isSystem: true, isActive: true },
  });
  if (!category) redirect(PATH);
  if (category.isSystem) redirect(flashUrl(path, "error", "The Class category cannot be removed."));

  const nextActive = formData.get("nextActive") === "true";
  await prisma.sessionCategory.update({ where: { id: categoryId }, data: { isActive: nextActive } });

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Category restored." : "Category archived."));
}

export async function removeSessionCategory(categoryId: string) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const category = await prisma.sessionCategory.findUnique({
    where: { id: categoryId },
    select: { name: true, isSystem: true, isActive: true },
  });
  if (!category) redirect(PATH);
  if (category.isSystem) redirect(flashUrl(PATH, "error", "The Class category cannot be removed."));

  await prisma.sessionCategory.update({ where: { id: categoryId }, data: { isActive: false } });
  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${category.name} was removed from new sessions.`));
}
