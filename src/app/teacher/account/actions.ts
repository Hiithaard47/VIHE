"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { hashPassword, passwordMatches, validateNewPassword } from "@/lib/password";

const PATH = "/teacher/account";

export async function changeOwnPassword(formData: FormData) {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const invalid = validateNewPassword(password, confirm);
  if (invalid) redirect(flashUrl(PATH, "error", invalid));

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, isActive: true },
  });
  if (!user?.isActive || !user.passwordHash) redirect(flashUrl(PATH, "error", "You cannot change this password."));
  if (!(await passwordMatches(current, user.passwordHash))) {
    redirect(flashUrl(PATH, "error", "Current password is incorrect."));
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Password updated."));
}
