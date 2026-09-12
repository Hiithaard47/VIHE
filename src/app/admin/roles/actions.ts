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

export async function createRole(formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.role.create({ data: parsed.data });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "A role with that name already exists."));
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${parsed.data.name} was created.`));
}

// The permission matrix posts one checkbox per (role, permission) cell as
// `perm:<permissionId>` so a single form submit can update a whole role row.
export async function updateRolePermissions(roleId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const permissionIds = formData
    .getAll("permissionIds")
    .map(String);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
  ]);

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Permissions updated."));
}

export async function deleteRole(roleId: string) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });
  if (role.isSystem) redirect(flashUrl(PATH, "error", "System roles cannot be deleted."));

  await prisma.role.delete({ where: { id: roleId } });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${role.name} was deleted.`));
}
