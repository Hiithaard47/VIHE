"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyOwnPasswordChange } from "@/lib/account-password";
import { flashUrl } from "@/lib/flash";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/rbac";

const PATH = "/student/account";

export async function changeOwnPassword(formData: FormData) {
  const session = await requireStudent();

  const student = await prisma.student.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, isActive: true },
  });
  await applyOwnPasswordChange(PATH, formData, student, async (passwordHash) => {
    await prisma.student.update({ where: { id: session.user.id }, data: { passwordHash } });
  });

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", "Password updated."));
}
