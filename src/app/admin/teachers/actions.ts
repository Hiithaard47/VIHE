"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const PATH = "/admin/teachers";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleIds: z.array(z.string()).default([]),
});

export async function createUser(formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleIds: formData.getAll("roleIds"),
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, email, password, roleIds } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(PATH, "error", "A user with that email already exists."));
    throw err;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${name} was added.`));
}

export async function updateUserRoles(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const roleIds = formData.getAll("roleIds").map(String);

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
  ]);

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Roles updated."));
}

export async function toggleUserActive(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const nextActive = formData.get("nextActive") === "true";
  await prisma.user.update({ where: { id: userId }, data: { isActive: nextActive } });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", nextActive ? "User reactivated." : "User deactivated."));
}
