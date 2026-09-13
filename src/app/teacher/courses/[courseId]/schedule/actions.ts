"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requireCourseConfigure } from "@/lib/rbac";
import { assertWritableBatch } from "@/lib/batch-scope";
import { insertSession } from "@/lib/session-write";
import { courseHref, parseCoursePortal, scheduleHref, type CoursePortal } from "@/lib/course-workspace";
import { isFutureSessionDate, parseDateInput } from "@/lib/time";
import { mondayOf, parseMeetingTimes } from "@/lib/schedule";

function revalidateSchedule(portal: CoursePortal, courseId: string, batchId: string) {
  const path = scheduleHref(portal, courseId, batchId);
  revalidatePath(path);
  revalidatePath(path.split("?")[0]);
  revalidatePath(courseHref(portal, courseId, "", batchId));
}

export async function saveSchedule(
  courseId: string,
  portalArg: CoursePortal,
  input: { batchId?: string; termStart: string; weekCount: number },
): Promise<{ ok: true } | { error: string }> {
  const session = await requireCourseConfigure(courseId, parseCoursePortal(portalArg));
  const portal = parseCoursePortal(portalArg);
  const path = scheduleHref(portal, courseId, input.batchId);
  await requireActiveCourse(courseId, path);
  const termStart = parseDateInput(input.termStart);
  if (!termStart) return { error: "Pick a term start date." };
  if (!Number.isInteger(input.weekCount) || input.weekCount < 1 || input.weekCount > 52) {
    return { error: "Weeks must be between 1 and 52." };
  }
  const batchId = await assertWritableBatch(session, courseId, input.batchId);
  if (!batchId) return { error: "You are not assigned to that batch." };

  await prisma.courseBatch.update({
    where: { id: batchId },
    data: { termStart: mondayOf(termStart), weekCount: input.weekCount },
  });

  revalidateSchedule(portal, courseId, batchId);
  return { ok: true };
}

export async function createScheduleSession(
  courseId: string,
  portalArg: CoursePortal,
  input: { batchId?: string; date: string; name: string; categoryId: string; startTime: string; endTime: string },
): Promise<{ ok: true } | { error: string }> {
  const session = await requireCourseConfigure(courseId, parseCoursePortal(portalArg));
  const portal = parseCoursePortal(portalArg);
  const path = scheduleHref(portal, courseId, input.batchId);
  await requireActiveCourse(courseId, path);
  const date = parseDateInput(input.date);
  if (!date) return { error: "Pick a valid date." };
  const name = input.name.trim();
  if (!name) return { error: "Enter a session name." };
  const times = parseMeetingTimes(input.startTime, input.endTime);
  if (!times) return { error: "Pick a valid start and end time." };
  const batchId = await assertWritableBatch(session, courseId, input.batchId);
  if (!batchId) return { error: "You are not assigned to that batch." };

  const category = await prisma.sessionCategory.findFirst({
    where: { id: input.categoryId, isActive: true },
    select: { id: true },
  });
  if (!category) return { error: "Pick a session category." };

  const created = await insertSession({
    batchId,
    categoryId: category.id,
    date,
    name,
    startMinute: times.startMinute,
    endMinute: times.endMinute,
    createdById: session.user.id,
    requireFuture: true,
    requireTime: true,
  });
  if ("error" in created) return created;
  revalidateSchedule(portal, courseId, batchId);
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
  if (!isFutureSessionDate(date)) return { error: "Cannot add a session on or before today." };

  const source = await prisma.classSession.findUniqueOrThrow({
    where: { id: input.sessionId },
    select: {
      batchId: true,
      name: true,
      categoryId: true,
      startMinute: true,
      endMinute: true,
      batch: { select: { courseId: true } },
    },
  });
  if (source.batch.courseId !== courseId) return { error: "That session is not on this course." };
  const batchId = await assertWritableBatch(session, courseId, source.batchId);
  if (!batchId) return { error: "You are not assigned to that batch." };

  const created = await insertSession({
    batchId,
    categoryId: source.categoryId,
    date,
    name: source.name,
    startMinute: source.startMinute,
    endMinute: source.endMinute,
    createdById: session.user.id,
    requireFuture: true,
    requireTime: true,
  });
  if ("error" in created) return created;
  revalidateSchedule(portal, courseId, batchId);
  return { ok: true };
}
