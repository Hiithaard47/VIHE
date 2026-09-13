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
import { parseMeetingTimes } from "@/lib/schedule";

export async function createSession(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  const portal = parseCoursePortal(portalArg);
  await requireCourseAccess(courseId, portal);
  const categoryHint = String(formData.get("categoryId") ?? "").trim() || undefined;
  const batchHint = String(formData.get("batchId") ?? "").trim() || undefined;
  const path = sessionListHref(portal, courseId, categoryHint, undefined, batchHint);
  await requireActiveCourse(courseId, path);
  const date = parseDateInput(String(formData.get("date") ?? ""));
  if (!date) redirect(flashUrl(path, "error", "Pick a valid date."));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(flashUrl(path, "error", "Enter a session name."));
  const category = categoryHint
    ? await prisma.sessionCategory.findFirst({ where: { id: categoryHint, isActive: true }, select: { id: true } })
    : null;
  if (!category) redirect(flashUrl(path, "error", "Pick a session category."));
  const batchId = await resolveWritableBatch(courseId, session.user.id, String(formData.get("batchId") ?? "") || null);
  if (!batchId) redirect(flashUrl(path, "error", "You are not assigned to a batch."));
  const startRaw = String(formData.get("startTime") ?? "").trim();
  const endRaw = String(formData.get("endTime") ?? "").trim();
  const times = startRaw || endRaw ? parseMeetingTimes(startRaw, endRaw) : null;
  if ((startRaw || endRaw) && !times) redirect(flashUrl(path, "error", "Pick a valid start and end time."));
  if (times) {
    const clash = await prisma.classSession.findFirst({
      where: { batchId, date, startMinute: times.startMinute },
      select: { id: true },
    });
    if (clash) redirect(flashUrl(path, "error", "That day already has a session at this time."));
  }

  await prisma.classSession.create({
    data: {
      batchId,
      categoryId: category.id,
      date,
      name,
      startMinute: times?.startMinute ?? null,
      endMinute: times?.endMinute ?? null,
      createdById: session.user.id,
    },
  });

  revalidatePath(courseHref(portal, courseId, "", batchId));
  redirect(flashUrl(sessionListHref(portal, courseId, category.id, undefined, batchHint), "success", "Session created."));
}
