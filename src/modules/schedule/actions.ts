"use server";

import { revalidatePath } from "next/cache";
import { requireActiveCourse, requireCourseConfigure } from "@/lib/rbac";
import { assertWritableSubject, subjectWriteDeniedMessage } from "@/lib/subject-scope";
import { insertSession } from "@/modules/sessions/service/session-write";
import { courseHref, parseCoursePortal, scheduleHref, type CoursePortal } from "@/lib/course-workspace";
import { canManagePastSessionDates } from "@/lib/permissions";
import { isFutureSessionDate, parseDateInput } from "@/lib/time";
import { mondayOf, parseMeetingTimes } from "./service/schedule";
import * as db from "./db/repository";

function revalidateSchedule(portal: CoursePortal, courseId: string, subjectId: string) {
  const path = scheduleHref(portal, courseId, subjectId);
  revalidatePath(path);
  revalidatePath(path.split("?")[0]);
  revalidatePath(courseHref(portal, courseId, "", subjectId));
}

export async function saveSchedule(
  courseId: string,
  portalArg: CoursePortal,
  input: { subjectId?: string; termStart: string; weekCount: number },
): Promise<{ ok: true } | { error: string }> {
  const session = await requireCourseConfigure(courseId, parseCoursePortal(portalArg));
  const portal = parseCoursePortal(portalArg);
  const path = scheduleHref(portal, courseId, input.subjectId);
  await requireActiveCourse(courseId, path);
  const termStart = parseDateInput(input.termStart);
  if (!termStart) return { error: "Pick a term start date." };
  if (!Number.isInteger(input.weekCount) || input.weekCount < 1 || input.weekCount > 52) {
    return { error: "Weeks must be between 1 and 52." };
  }
  const subjectId = await assertWritableSubject(session, courseId, input.subjectId);
  if (!subjectId) return { error: await subjectWriteDeniedMessage(courseId, input.subjectId) };

  await db.updateSubjectTerm(subjectId, {
    termStart: mondayOf(termStart),
    weekCount: input.weekCount,
  });

  revalidateSchedule(portal, courseId, subjectId);
  return { ok: true };
}

export async function createScheduleSession(
  courseId: string,
  portalArg: CoursePortal,
  input: { subjectId?: string; date: string; name: string; categoryId: string; startTime: string; endTime: string },
): Promise<{ ok: true } | { error: string }> {
  const session = await requireCourseConfigure(courseId, parseCoursePortal(portalArg));
  const portal = parseCoursePortal(portalArg);
  const path = scheduleHref(portal, courseId, input.subjectId);
  await requireActiveCourse(courseId, path);
  const date = parseDateInput(input.date);
  if (!date) return { error: "Pick a valid date." };
  const name = input.name.trim();
  if (!name) return { error: "Enter a session name." };
  const times = parseMeetingTimes(input.startTime, input.endTime);
  if (!times) return { error: "Pick a valid start and end time." };
  const subjectId = await assertWritableSubject(session, courseId, input.subjectId);
  if (!subjectId) return { error: await subjectWriteDeniedMessage(courseId, input.subjectId) };

  const category = await db.findActiveCategory(input.categoryId);
  if (!category) return { error: "Pick a session category." };

  const allowPast = canManagePastSessionDates(session.user.permissions, portal);
  const created = await insertSession({
    subjectId,
    categoryId: category.id,
    date,
    name,
    startMinute: times.startMinute,
    endMinute: times.endMinute,
    createdById: session.user.id,
    requireFuture: !allowPast,
    requireTime: true,
  });
  if ("error" in created) return created;
  revalidateSchedule(portal, courseId, subjectId);
  return { ok: true };
}

export async function duplicateOneOffSession(
  courseId: string,
  portalArg: CoursePortal,
  input: { sessionId: string; date: string },
): Promise<{ ok: true } | { error: string }> {
  const session = await requireCourseConfigure(courseId, parseCoursePortal(portalArg));
  const portal = parseCoursePortal(portalArg);
  await requireActiveCourse(courseId, scheduleHref(portal, courseId));
  const date = parseDateInput(input.date);
  if (!date) return { error: "Pick a valid date." };
  const allowPast = canManagePastSessionDates(session.user.permissions, portal);
  if (!allowPast && !isFutureSessionDate(date)) {
    return { error: "Cannot add a session on or before today." };
  }

  const source = await db.findSessionSource(input.sessionId);
  if (source.subject.courseId !== courseId) return { error: "That session is not on this course." };
  const subjectId = await assertWritableSubject(session, courseId, source.subjectId);
  if (!subjectId) return { error: await subjectWriteDeniedMessage(courseId, source.subjectId) };

  const created = await insertSession({
    subjectId,
    categoryId: source.categoryId,
    date,
    name: source.name,
    startMinute: source.startMinute,
    endMinute: source.endMinute,
    createdById: session.user.id,
    requireFuture: !allowPast,
    requireTime: true,
  });
  if ("error" in created) return created;
  revalidateSchedule(portal, courseId, subjectId);
  return { ok: true };
}
