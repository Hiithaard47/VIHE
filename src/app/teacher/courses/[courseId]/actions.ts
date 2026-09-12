"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { resolveBatchForCourse } from "@/lib/enrollment";

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
  const batchId = await resolveBatchForCourse(
    courseId,
    session.user.id,
    session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE),
  );
  if (!batchId) redirect(flashUrl(path, "error", "You are not assigned to a batch."));

  await prisma.classSession.create({
    data: {
      batchId,
      date: new Date(parsed.data.date),
      topic: parsed.data.topic,
      createdById: session.user.id,
    },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Session created."));
}
