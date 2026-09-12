"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requireCourseAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { resolveWritableBatch } from "@/lib/enrollment";
import { courseHref, parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";
import { parseDateInput } from "@/lib/time";

export async function createSession(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  const portal = parseCoursePortal(portalArg);
  await requireCourseAccess(courseId, portal);
  const path = courseHref(portal, courseId);
  await requireActiveCourse(courseId, path);
  const date = parseDateInput(String(formData.get("date") ?? ""));
  if (!date) redirect(flashUrl(path, "error", "Pick a valid date."));
  const topic = String(formData.get("topic") ?? "").trim() || undefined;
  const batchId = await resolveWritableBatch(courseId, session.user.id, String(formData.get("batchId") ?? "") || null);
  if (!batchId) redirect(flashUrl(path, "error", "You are not assigned to a batch."));

  await prisma.classSession.create({
    data: {
      batchId,
      date,
      topic,
      createdById: session.user.id,
    },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Session created."));
}
