"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import {
  createRole as createRoleService,
  updateRoleDetails as updateRoleDetailsService,
  updateRolePermissions as updateRolePermissionsService,
  deleteRole as deleteRoleService,
  isRoleError,
} from "./service/roles";

const PATH = "/admin/roles";

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional(),
});

function rolePath(roleId: string) {
  return `${PATH}/${roleId}`;
}

function fail(path: string, error: unknown): never {
  if (isRoleError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
}

export async function createRole(formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    const result = await createRoleService(parsed.data);
    revalidatePath(PATH);
    redirect(flashUrl(rolePath(result.id), "success", `${result.name} was created.`));
  } catch (error) {
    fail(PATH, error);
  }
}

export async function updateRoleDetails(roleId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const path = `${rolePath(roleId)}/details`;

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await updateRoleDetailsService({
      roleId,
      name: parsed.data.name,
      description: parsed.data.description,
    });
  } catch (error) {
    fail(path, error);
  }

  revalidatePath(PATH);
  revalidatePath(rolePath(roleId));
  redirect(flashUrl(path, "success", "Role details saved."));
}

export async function updateRolePermissions(roleId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const path = rolePath(roleId);

  const permissionIds = formData.getAll("permissionIds").map(String);
  await updateRolePermissionsService(roleId, permissionIds);

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Permissions updated."));
}

export async function deleteRole(roleId: string) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  try {
    const result = await deleteRoleService(roleId);
    revalidatePath(PATH);
    redirect(flashUrl(PATH, "success", `${result.name} was deleted.`));
  } catch (error) {
    fail(rolePath(roleId), error);
  }
}
