"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requireCourseAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { resolveWritableBatch } from "@/lib/enrollment";
import { courseHref, parseCoursePortal, sessionListHref, type CoursePortal } from "@/lib/course-workspace";
import { parseDateInput } from "@/lib/time";

export async function createSession(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  const portal = parseCoursePortal(portalArg);
  await requireCourseAccess(courseId, portal);
  const path = courseHref(portal, courseId);
  await requireActiveCourse(courseId, path);
  const date = parseDateInput(String(formData.get("date") ?? ""));
  if (!date) redirect(flashUrl(path, "error", "Pick a valid date."));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(flashUrl(path, "error", "Enter a session name."));
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const category = categoryId
    ? await prisma.sessionCategory.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } })
    : null;
  if (!category) redirect(flashUrl(path, "error", "Pick a session category."));
  const batchId = await resolveWritableBatch(courseId, session.user.id, String(formData.get("batchId") ?? "") || null);
  if (!batchId) redirect(flashUrl(path, "error", "You are not assigned to a batch."));

  await prisma.classSession.create({
    data: {
      batchId,
      categoryId: category.id,
      date,
      name,
      createdById: session.user.id,
    },
  });

  revalidatePath(path);
  redirect(flashUrl(sessionListHref(portal, courseId, category.id), "success", "Session created."));
}
