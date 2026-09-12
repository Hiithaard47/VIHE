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

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("A valid email is required."),
});

async function requireActiveUser(userId: string, path: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user) redirect(PATH);
  if (!user.isActive) redirect(flashUrl(path, "error", "This teacher is archived. Restore to make changes."));
}

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

export async function updateUserDetails(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}/details`;
  await requireActiveUser(userId, path);
  const parsed = detailsSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name, email: parsed.data.email },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "A user with that email already exists."));
    throw err;
  }

  revalidatePath(PATH);
  revalidatePath(`/admin/teachers/${userId}`);
  redirect(flashUrl(path, "success", "Teacher details saved."));
}

export async function updateUserRoles(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}/roles`;
  await requireActiveUser(userId, path);

  const roleIds = formData.getAll("roleIds").map(String);
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
  ]);

  revalidatePath(PATH);
  revalidatePath(`/admin/teachers/${userId}`);
  redirect(flashUrl(path, "success", "Roles updated."));
}

export async function toggleUserActive(userId: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}`;
  if (session.user.id === userId) {
    redirect(flashUrl(path, "error", "You cannot archive your own account."));
  }

  const nextActive = formData.get("nextActive") === "true";
  await prisma.user.update({ where: { id: userId }, data: { isActive: nextActive } });

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Teacher restored." : "Teacher archived."));
}
