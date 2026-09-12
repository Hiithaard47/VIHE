"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { hashPassword, validateNewPassword } from "@/lib/password";

const PATH = "/admin/teachers";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  password: z.string().min(8),
  roleIds: z.array(z.string()).default([]),
});

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("A valid email is required."),
  phone: z.string().optional().default(""),
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
    phone: formData.get("phone") || "",
    password: formData.get("password"),
    roleIds: formData.getAll("roleIds"),
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  const { name, email, phone, password, roleIds } = parsed.data;

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        phone: phone.trim() || null,
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
  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone.trim() || null },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(flashUrl(path, "error", "A user with that email already exists."));
    throw err;
  }

  revalidatePath(PATH);
  revalidatePath(`/admin/teachers/${userId}`);
  redirect(flashUrl(path, "success", "Teacher details saved."));
}

export async function resetUserPassword(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}/details`;
  await requireActiveUser(userId, path);

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const invalid = validateNewPassword(password, confirm);
  if (invalid) redirect(flashUrl(path, "error", invalid));

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Password reset. Share the new password with the teacher."));
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
