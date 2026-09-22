"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requireSubjectAccess } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { parseCoursePortal, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { findSessionForAttendance, markSessionAttendance, parseAttendanceFormStatuses } from "./service/mark";
import { isAttendanceError } from "./service/errors";

export async function markAttendance(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const path = sessionHref(portal, sessionId);
  const actor = await requireAnyPermission([PERMISSIONS.ATTENDANCE_MARK]);

  const classSession = await findSessionForAttendance(sessionId);
  if (!classSession) redirect(flashUrl(path, "error", "That session was not found."));
  await requireSubjectAccess(classSession.subjectId, portal);

  try {
    await markSessionAttendance({
      classSession,
      actor,
      statuses: parseAttendanceFormStatuses(formData),
    });
    revalidatePath(path);
    redirect(flashUrl(path, "success", "Attendance saved."));
  } catch (error) {
    if (isAttendanceError(error)) redirect(flashUrl(path, "error", error.message));
    throw error;
  }
}
