"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AttendanceStatus } from "@prisma/client";
import { flashUrl } from "@/lib/flash";

const STATUS_VALUES = new Set(Object.values(AttendanceStatus));

export async function markAttendance(sessionId: string, formData: FormData) {
  const session = await requireAnyPermission([PERMISSIONS.ATTENDANCE_MARK]);

  const classSession = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { batch: { select: { courseId: true } } },
  });
  await requireCourseAccess(classSession.batch.courseId);

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

  const path = `/teacher/sessions/${sessionId}`;
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Attendance saved."));
}
