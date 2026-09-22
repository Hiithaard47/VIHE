"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS, TEACHER_PORTAL_PERMISSIONS } from "@/lib/permissions";
import { requireAnyPermission, requireStudent } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import {
  changeUserPassword,
  changeStudentPassword as changeStudentPasswordService,
  isAccountError,
} from "./service/account-password";

function readPasswordChange(formData: FormData) {
  return {
    current: String(formData.get("current") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  };
}

export async function changeAdminPassword(formData: FormData) {
  const PATH = "/admin/account";
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.COURSES_MANAGE,
    PERMISSIONS.STUDENTS_MANAGE,
  ]);

  const { current, password, confirm } = readPasswordChange(formData);

  try {
    await changeUserPassword({ userId: session.user.id, current, password, confirm });
  } catch (error) {
    if (isAccountError(error)) redirect(flashUrl(PATH, "error", error.message));
    throw error;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Password updated."));
}

export async function changeTeacherPassword(formData: FormData) {
  const PATH = "/teacher/account";
  const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);

  const { current, password, confirm } = readPasswordChange(formData);

  try {
    await changeUserPassword({ userId: session.user.id, current, password, confirm });
  } catch (error) {
    if (isAccountError(error)) redirect(flashUrl(PATH, "error", error.message));
    throw error;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Password updated."));
}

export async function changeStudentPassword(formData: FormData) {
  const PATH = "/student/account";
  const session = await requireStudent();

  const { current, password, confirm } = readPasswordChange(formData);

  try {
    await changeStudentPasswordService({ studentId: session.user.id, current, password, confirm });
  } catch (error) {
    if (isAccountError(error)) redirect(flashUrl(PATH, "error", error.message));
    throw error;
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Password updated."));
}
