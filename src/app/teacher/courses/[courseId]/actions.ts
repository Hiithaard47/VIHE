"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requireCourseAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { assertWritableSubject, subjectWriteDeniedMessage } from "@/lib/subject-scope";
import { insertSession } from "@/lib/session-write";
import { courseHref, parseCoursePortal, sessionListHref, type CoursePortal } from "@/lib/course-workspace";
import { parseDateInput } from "@/lib/time";
import { parseMeetingTimes } from "@/lib/schedule";

export async function createSession(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  const portal = parseCoursePortal(portalArg);
  await requireCourseAccess(courseId, portal);
  const categoryHint = String(formData.get("categoryId") ?? "").trim() || undefined;
  const subjectHint = String(formData.get("subjectId") ?? "").trim() || undefined;
  const path = sessionListHref(portal, courseId, categoryHint, subjectHint);
  await requireActiveCourse(courseId, path);
  const date = parseDateInput(String(formData.get("date") ?? ""));
  if (!date) redirect(flashUrl(path, "error", "Pick a valid date."));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(flashUrl(path, "error", "Enter a session name."));
  const category = categoryHint
    ? await prisma.sessionCategory.findFirst({ where: { id: categoryHint, isActive: true }, select: { id: true } })
    : null;
  if (!category) redirect(flashUrl(path, "error", "Pick a session category."));
  const requestedSubjectId = String(formData.get("subjectId") ?? "").trim() || null;
  const subjectId = await assertWritableSubject(session, courseId, requestedSubjectId);
  if (!subjectId) {
    redirect(flashUrl(path, "error", await subjectWriteDeniedMessage(courseId, requestedSubjectId)));
  }
  const startRaw = String(formData.get("startTime") ?? "").trim();
  const endRaw = String(formData.get("endTime") ?? "").trim();
  const times = startRaw || endRaw ? parseMeetingTimes(startRaw, endRaw) : null;
  if ((startRaw || endRaw) && !times) redirect(flashUrl(path, "error", "Pick a valid start and end time."));

  const created = await insertSession({
    subjectId,
    categoryId: category.id,
    date,
    name,
    startMinute: times?.startMinute ?? null,
    endMinute: times?.endMinute ?? null,
    createdById: session.user.id,
  });
  if ("error" in created) redirect(flashUrl(path, "error", created.error));

  revalidatePath(courseHref(portal, courseId, "", subjectId));
  redirect(flashUrl(sessionListHref(portal, courseId, category.id, subjectHint), "success", "Session created."));
}
