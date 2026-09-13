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
