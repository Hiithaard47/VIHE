"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBatchAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AttendanceStatus } from "@prisma/client";
import { flashUrl } from "@/lib/flash";
import { deleteObject, isStorageConfigured, putObject } from "@/lib/storage";
import { sanitizeFileName, validateResourceFile } from "@/lib/session-resources";
import { isFutureSessionDate, parseDateInput, startOfTodayUtc } from "@/lib/time";
import { courseHref, parseCoursePortal, safeWorkspaceReturnTo, sessionHref, type CoursePortal } from "@/lib/course-workspace";

const STATUS_VALUES = new Set(Object.values(AttendanceStatus));

export async function updateSessionDate(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE]);

  const classSession = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { date: true, batchId: true, batch: { select: { courseId: true } } },
  });
  await requireBatchAccess(classSession.batchId, portal);
  const fallback = sessionHref(portal, sessionId);
  const path = safeWorkspaceReturnTo(formData.get("returnTo"), fallback);

  if (!isFutureSessionDate(classSession.date)) {
    redirect(flashUrl(path, "error", "Only future sessions can change date."));
  }

  const nextDate = parseDateInput(String(formData.get("date") ?? ""));
  if (!nextDate) redirect(flashUrl(path, "error", "Pick a valid date."));
  if (nextDate.getTime() < startOfTodayUtc().getTime()) {
    redirect(flashUrl(path, "error", "Pick today or a future date."));
  }

  await prisma.classSession.update({ where: { id: sessionId }, data: { date: nextDate } });

  revalidatePath(path);
  revalidatePath(courseHref(portal, classSession.batch.courseId));
  revalidatePath(fallback);
  redirect(flashUrl(path, "success", "Session date updated."));
}

export async function markAttendance(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.ATTENDANCE_MARK]);

  const classSession = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { batchId: true },
  });
  await requireBatchAccess(classSession.batchId, parseCoursePortal(portalArg));

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { batchId: classSession.batchId },
    select: { studentId: true },
  });

  const upserts = enrollments.flatMap(({ studentId }) => {
    const raw = formData.get(`status:${studentId}`);
    if (typeof raw !== "string" || !STATUS_VALUES.has(raw as AttendanceStatus)) return [];
    const status = raw as AttendanceStatus;

    return [
      prisma.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId, studentId } },
        create: { sessionId, studentId, status, markedById: session.user.id },
        update: { status, markedById: session.user.id, markedAt: new Date() },
      }),
    ];
  });

  await prisma.$transaction(upserts);

  const path = sessionHref(parseCoursePortal(portalArg), sessionId);
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Attendance saved."));
}

export async function uploadSessionResource(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const path = sessionHref(portal, sessionId);
  const classSession = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { batchId: true },
  });
  const session = await requireBatchAccess(classSession.batchId, portal);

  if (!isStorageConfigured()) {
    redirect(flashUrl(path, "error", "File storage is not configured."));
  }

  const file = formData.get("file");
  if (!(file instanceof File)) redirect(flashUrl(path, "error", "Choose a file to upload."));
  const invalid = validateResourceFile(file);
  if (invalid) redirect(flashUrl(path, "error", invalid));

  const fileName = sanitizeFileName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const resource = await prisma.sessionResource.create({
    data: {
      sessionId,
      fileName,
      contentType: file.type,
      sizeBytes: file.size,
      storageKey: `pending/${sessionId}/${crypto.randomUUID()}`,
      uploadedById: session.user.id,
    },
  });
  const storageKey = `sessions/${sessionId}/${resource.id}/${fileName}`;

  try {
    await putObject(storageKey, bytes, file.type);
    await prisma.sessionResource.update({ where: { id: resource.id }, data: { storageKey } });
  } catch {
    await prisma.sessionResource.delete({ where: { id: resource.id } }).catch(() => {});
    redirect(flashUrl(path, "error", "Could not store that file."));
  }

  revalidatePath(path);
  redirect(flashUrl(path, "success", `${fileName} was uploaded.`));
}

export async function deleteSessionResource(sessionId: string, resourceId: string, portalArg: CoursePortal, formData?: FormData) {
  const portal = parseCoursePortal(portalArg);
  const path = sessionHref(portal, sessionId);
  const returnTo = safeWorkspaceReturnTo(formData?.get("returnTo") ?? null, path);
  const resource = await prisma.sessionResource.findUniqueOrThrow({
    where: { id: resourceId },
    include: { session: { select: { id: true, batchId: true } } },
  });
  if (resource.session.id !== sessionId) redirect(flashUrl(returnTo, "error", "That file is not on this session."));
  await requireBatchAccess(resource.session.batchId, portal);

  if (isStorageConfigured()) {
    await deleteObject(resource.storageKey).catch(() => {});
  }
  await prisma.sessionResource.delete({ where: { id: resourceId } });

  revalidatePath(path);
  revalidatePath(returnTo);
  redirect(flashUrl(returnTo, "success", "File removed."));
}
