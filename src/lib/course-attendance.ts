import { prisma } from "@/lib/prisma";
import { emptyTally, type StatusTally, type StatusValue } from "@/lib/attendance";
import { type BatchScope, sessionWhere } from "@/lib/batch-scope";
import { startOfTodayUtc } from "@/lib/time";

export type StudentCategoryTallies = Map<string, Map<string, StatusTally>>;

export function recordInTallies(
  tallies: StudentCategoryTallies,
  studentId: string,
  categoryId: string,
  status: StatusValue,
) {
  let byCategory = tallies.get(studentId);
  if (!byCategory) {
    byCategory = new Map();
    tallies.set(studentId, byCategory);
  }
  const tally = byCategory.get(categoryId) ?? emptyTally();
  tally[status] += 1;
  byCategory.set(categoryId, tally);
}

export function tallyFor(tallies: StudentCategoryTallies, studentId: string, categoryId: string): StatusTally {
  return tallies.get(studentId)?.get(categoryId) ?? emptyTally();
}

export type AttendanceMarks = Map<string, Map<string, StatusValue>>;

export function recordMark(marks: AttendanceMarks, studentId: string, sessionId: string, status: StatusValue) {
  let bySession = marks.get(studentId);
  if (!bySession) {
    bySession = new Map();
    marks.set(studentId, bySession);
  }
  bySession.set(sessionId, status);
}

export function statusAt(marks: AttendanceMarks, studentId: string, sessionId: string): StatusValue | null {
  return marks.get(studentId)?.get(sessionId) ?? null;
}

export async function loadAttendanceTallies(courseId: string, scope: BatchScope) {
  const records = await prisma.attendanceRecord.findMany({
    where: { session: { ...sessionWhere(courseId, scope), date: { lte: startOfTodayUtc() } } },
    select: { studentId: true, status: true, session: { select: { categoryId: true } } },
  });

  const tallies: StudentCategoryTallies = new Map();
  for (const row of records) {
    recordInTallies(tallies, row.studentId, row.session.categoryId, row.status);
  }
  return tallies;
}

export async function loadCourseAttendanceCategories(courseId: string, scope: BatchScope) {
  return prisma.sessionCategory.findMany({
    where: { sessions: { some: sessionWhere(courseId, scope) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, minAttendancePercent: true },
  });
}

export async function loadAttendanceMatrix(courseId: string, scope: BatchScope) {
  const sessions = await prisma.classSession.findMany({
    where: sessionWhere(courseId, scope),
    orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    select: {
      id: true,
      date: true,
      name: true,
      category: { select: { id: true, name: true } },
      records: { select: { studentId: true, status: true } },
    },
  });

  const marks: AttendanceMarks = new Map();
  for (const session of sessions) {
    for (const record of session.records) {
      recordMark(marks, record.studentId, session.id, record.status);
    }
  }

  return { sessions, marks };
}
