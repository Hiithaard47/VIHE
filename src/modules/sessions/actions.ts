"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSubjectAccess, requireAnyPermission, requireActiveCourse, requireCourseAccess } from "@/lib/rbac";
import { canManagePastSessionDates, PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { parseMeetingTimes } from "@/modules/schedule/service/schedule";
import { isFutureSessionDate, parseDateInput, startOfTodayUtc } from "@/lib/time";
import { courseHref, parseCoursePortal, safeWorkspaceReturnTo, sessionHref, sessionListHref, type CoursePortal } from "@/lib/course-workspace";
import { assertWritableSubject, subjectWriteDeniedMessage } from "@/lib/subject-scope";
import { insertSession } from "./service/session-write";
import * as db from "./db/repository";

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
  const category = categoryHint ? await db.findActiveCategory(categoryHint) : null;
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

  const allowPast = canManagePastSessionDates(session.user.permissions, portal);
  const created = await insertSession({
    subjectId,
    categoryId: category.id,
    date,
    name,
    startMinute: times?.startMinute ?? null,
    endMinute: times?.endMinute ?? null,
    createdById: session.user.id,
    requireFuture: !allowPast,
  });
  if ("error" in created) redirect(flashUrl(path, "error", created.error));

  revalidatePath(courseHref(portal, courseId, "", subjectId));
  redirect(flashUrl(sessionListHref(portal, courseId, category.id, subjectHint), "success", "Session created."));
}

export async function updateSessionDate(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const auth = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);

  const classSession = await db.findSessionWithSubject(sessionId);
  await requireSubjectAccess(classSession.subjectId, portal);
  const fallback = sessionHref(portal, sessionId);
  const path = safeWorkspaceReturnTo(formData.get("returnTo"), fallback);
  const allowPast = canManagePastSessionDates(auth.user.permissions, portal);

  if (!allowPast && !isFutureSessionDate(classSession.date)) {
    redirect(flashUrl(path, "error", "Only future sessions can change date or time."));
  }

  const nextDate = parseDateInput(String(formData.get("date") ?? ""));
  if (!nextDate) redirect(flashUrl(path, "error", "Pick a valid date."));
  if (!allowPast && nextDate.getTime() < startOfTodayUtc().getTime()) {
    redirect(flashUrl(path, "error", "Pick today or a future date."));
  }
  const times = parseMeetingTimes(String(formData.get("startTime") ?? ""), String(formData.get("endTime") ?? ""));
  if (!times) redirect(flashUrl(path, "error", "Pick a valid start and end time."));

  const clash = await db.findSessionClashExcluding(
    classSession.subjectId,
    nextDate,
    times.startMinute,
    sessionId,
  );
  if (clash) redirect(flashUrl(path, "error", "That day already has a session at this time."));

  await db.updateSessionDateRecord(sessionId, {
    date: nextDate,
    startMinute: times.startMinute,
    endMinute: times.endMinute,
  });

  revalidatePath(path);
  revalidatePath(courseHref(portal, classSession.subject.courseId, "", classSession.subjectId));
  revalidatePath(fallback);
  redirect(flashUrl(path, "success", "Session updated."));
}

export async function deleteSession(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  const classSession = await db.findSessionWithSubject(sessionId);
  await requireSubjectAccess(classSession.subjectId, portal);
  const path = safeWorkspaceReturnTo(formData.get("returnTo"), courseHref(portal, classSession.subject.courseId, "", classSession.subjectId));
  if (classSession._count.records > 0) {
    redirect(flashUrl(path, "error", "Cannot remove a session that has attendance."));
  }
  await db.deleteSessionRecord(sessionId);
  revalidatePath(path);
  revalidatePath(courseHref(portal, classSession.subject.courseId, "", classSession.subjectId));
  redirect(flashUrl(path, "success", "Session removed."));
}

export async function moveSession(
  sessionId: string,
  portalArg: CoursePortal,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const portal = parseCoursePortal(portalArg);
  const auth = await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);
  const classSession = await db.findSessionWithSubject(sessionId);
  await requireSubjectAccess(classSession.subjectId, portal);
  const path = safeWorkspaceReturnTo(formData.get("returnTo"), courseHref(portal, classSession.subject.courseId, "", classSession.subjectId));
  if (classSession._count.records > 0) {
    return { error: "Cannot move a session that has attendance." };
  }
  const allowPast = canManagePastSessionDates(auth.user.permissions, portal);
  if (!allowPast && !isFutureSessionDate(classSession.date)) {
    return { error: "Cannot change a session on or before today." };
  }
  const nextDate = parseDateInput(String(formData.get("date") ?? ""));
  if (!nextDate) return { error: "Pick a valid date." };
  if (!allowPast && nextDate.getTime() < startOfTodayUtc().getTime()) {
    return { error: "Pick today or a future date." };
  }
  const clash = await db.findSessionClashExcluding(
    classSession.subjectId,
    nextDate,
    classSession.startMinute ?? -1,
    sessionId,
  );
  if (clash) return { error: "That day already has a session at this time." };
  await db.updateSessionDate(sessionId, nextDate);
  revalidatePath(path);
  revalidatePath(courseHref(portal, classSession.subject.courseId, "", classSession.subjectId));
  return { ok: true };
}
