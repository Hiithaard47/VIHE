"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { parseAllowsResources, parseMinAttendancePercent } from "./service/session-categories";
import {
  createCategory,
  findCategoryById,
  updateCategory,
  toggleCategoryActive,
  findCategoryForToggle,
} from "./db/repository";

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
  return {
    name: parsed.data.name,
    minAttendancePercent,
    allowsResources: parseAllowsResources(formData),
  };
}

export async function createSessionCategory(formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const data = parseCategoryForm(formData, PATH);

  try {
    const category = await createCategory(data);
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
  const category = await findCategoryById(categoryId);
  if (!category) redirect(PATH);
  if (!category.isActive) redirect(flashUrl(path, "error", "This category is archived. Restore to make changes."));

  const data = parseCategoryForm(formData, path);

  try {
    await updateCategory(categoryId, {
      name: category.isSystem ? undefined : data.name,
      minAttendancePercent: data.minAttendancePercent,
      allowsResources: data.allowsResources,
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
  const category = await findCategoryForToggle(categoryId);
  if (!category) redirect(PATH);
  if (category.isSystem) redirect(flashUrl(path, "error", "The Class category cannot be removed."));

  const nextActive = formData.get("nextActive") === "true";
  await toggleCategoryActive(categoryId, nextActive);

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Category restored." : "Category archived."));
}

export async function removeSessionCategory(categoryId: string) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const category = await findCategoryForToggle(categoryId);
  if (!category) redirect(PATH);
  if (category.isSystem) redirect(flashUrl(PATH, "error", "The Class category cannot be removed."));

  await toggleCategoryActive(categoryId, false);
  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${category.name} was removed from new sessions.`));
}
