"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import {
  createUser as createUserService,
  updateUserDetails as updateUserDetailsService,
  resetUserPassword as resetUserPasswordService,
  updateUserRoles as updateUserRolesService,
  toggleUserActive as toggleUserActiveService,
  isTeacherError,
} from "./service/teachers";

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

function fail(path: string, error: unknown): never {
  if (isTeacherError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
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

  try {
    const result = await createUserService(parsed.data);
    revalidatePath(PATH);
    redirect(flashUrl(PATH, "success", `${result.name} was added.`));
  } catch (error) {
    fail(PATH, error);
  }
}

export async function updateUserDetails(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}/details`;
  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await updateUserDetailsService({ userId, ...parsed.data });
  } catch (error) {
    fail(path, error);
  }

  revalidatePath(PATH);
  revalidatePath(`/admin/teachers/${userId}`);
  redirect(flashUrl(path, "success", "Teacher details saved."));
}

export async function resetUserPassword(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}/details`;

  try {
    await resetUserPasswordService({
      userId,
      password: String(formData.get("password") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
  } catch (error) {
    fail(path, error);
  }

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Password reset. Share the new password with the teacher."));
}

export async function updateUserRoles(userId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}/roles`;

  try {
    await updateUserRolesService(userId, formData.getAll("roleIds").map(String));
  } catch (error) {
    fail(path, error);
  }

  revalidatePath(PATH);
  revalidatePath(`/admin/teachers/${userId}`);
  redirect(flashUrl(path, "success", "Roles updated."));
}

export async function toggleUserActive(userId: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = `/admin/teachers/${userId}`;

  try {
    const nextActive = formData.get("nextActive") === "true";
    await toggleUserActiveService({ userId, nextActive, actorId: session.user.id });
    revalidatePath(PATH);
    revalidatePath(path);
    redirect(flashUrl(path, "success", nextActive ? "Teacher restored." : "Teacher archived."));
  } catch (error) {
    fail(path, error);
  }
}
