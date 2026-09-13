"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyOwnPasswordChange } from "@/lib/account-password";
import { flashUrl } from "@/lib/flash";
import { TEACHER_PORTAL_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";

const PATH = "/teacher/account";

export async function changeOwnPassword(formData: FormData) {
  const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, isActive: true },
  });
  await applyOwnPasswordChange(PATH, formData, user, async (passwordHash) => {
    await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });
  });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Password updated."));
}
