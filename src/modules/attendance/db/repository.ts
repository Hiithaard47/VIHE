import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfTodayUtc } from "@/lib/time";

export async function findSessionForMarking(sessionId: string) {
  return prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      subjectId: true,
      date: true,
      subject: { select: { courseId: true, course: { select: { lockAfterDays: true } } } },
    },
  });
}

export async function listCourseEnrollmentStudentIds(courseId: string) {
  return prisma.courseEnrollment.findMany({
    where: { courseId },
    select: { studentId: true },
  });
}

export async function upsertAttendanceMarks(
  sessionId: string,
  markedById: string,
  marks: Array<{ studentId: string; status: AttendanceStatus }>,
) {
  if (marks.length === 0) return;
  const now = new Date();
  await prisma.$transaction(
    marks.map(({ studentId, status }) =>
      prisma.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId, studentId } },
        create: { sessionId, studentId, status, markedById },
        update: { status, markedById, markedAt: now },
      }),
    ),
  );
}

export async function findAttendanceRecordsForTallies(where: Prisma.ClassSessionWhereInput) {
  return prisma.attendanceRecord.findMany({
    where: { session: { ...where, date: { lte: startOfTodayUtc() } } },
    select: { studentId: true, status: true, session: { select: { categoryId: true } } },
  });
}

export async function findAttendanceCategories(where: Prisma.ClassSessionWhereInput) {
  return prisma.sessionCategory.findMany({
    where: { sessions: { some: where } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, minAttendancePercent: true },
  });
}

export async function findAttendanceMatrixSessions(where: Prisma.ClassSessionWhereInput) {
  return prisma.classSession.findMany({
    where,
    orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    select: {
      id: true,
      date: true,
      name: true,
      category: { select: { id: true, name: true } },
      records: { select: { studentId: true, status: true } },
    },
  });
}

export async function findCourseAttendanceHeader(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: {
      name: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      enrollments: { include: { student: true }, orderBy: { student: { name: "asc" } } },
    },
  });
}

export async function findSubjectName(subjectId: string) {
  return prisma.courseSubject.findUnique({ where: { id: subjectId }, select: { name: true } });
}

export async function findSubjectTeacherNames(
  courseId: string,
  scope: { kind: "all" } | { kind: "ids"; ids: readonly string[] },
  subjectId?: string,
) {
  return prisma.user.findMany({
    where: {
      taughtSubjects: {
        some: subjectId
          ? { subjectId }
          : {
              subject: {
                courseId,
                ...(scope.kind === "ids" ? { id: { in: [...scope.ids] } } : { isActive: true }),
              },
            },
      },
    },
    orderBy: { name: "asc" },
    select: { name: true },
  });
}
