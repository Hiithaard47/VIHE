"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

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

export async function createRole(formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  let role;
  try {
    role = await prisma.role.create({ data: parsed.data });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "A role with that name already exists."));
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(rolePath(role.id), "success", `${parsed.data.name} was created.`));
}

export async function updateRoleDetails(roleId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const path = `${rolePath(roleId)}/details`;
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { isSystem: true } });
  if (!role) redirect(PATH);

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.role.update({
      where: { id: roleId },
      data: {
        name: role.isSystem ? undefined : parsed.data.name,
        description: parsed.data.description || null,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "A role with that name already exists."));
    throw err;
  }

  revalidatePath(PATH);
  revalidatePath(rolePath(roleId));
  redirect(flashUrl(path, "success", "Role details saved."));
}

export async function updateRolePermissions(roleId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const path = rolePath(roleId);

  const permissionIds = formData.getAll("permissionIds").map(String);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
  ]);

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Permissions updated."));
}

export async function deleteRole(roleId: string) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });
  if (role.isSystem) redirect(flashUrl(rolePath(roleId), "error", "System roles cannot be deleted."));

  await prisma.role.delete({ where: { id: roleId } });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${role.name} was deleted.`));
}
