"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";

const createSessionSchema = z.object({
  date: z.string().min(1),
  topic: z.string().optional(),
});

export async function createSession(courseId: string, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  await requireCourseAccess(courseId);

  const path = `/teacher/courses/${courseId}`;

  const parsed = createSessionSchema.safeParse({
    date: formData.get("date"),
    topic: formData.get("topic") || undefined,
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  await prisma.classSession.create({
    data: {
      courseId,
      date: new Date(parsed.data.date),
      topic: parsed.data.topic,
      createdById: session.user.id,
    },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Session created."));
}
