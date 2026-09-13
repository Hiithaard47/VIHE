import { prisma } from "@/lib/prisma";
import { emptyTally, type StatusTally, type StatusValue } from "@/lib/attendance";
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

function attendanceSessionWhere(courseId: string, batchIds: string | readonly string[] | null) {
  const ids = batchIds == null ? [] : typeof batchIds === "string" ? [batchIds] : [...batchIds];
  const date = { lte: startOfTodayUtc() };
  if (ids.length === 0) return { batch: { courseId }, date };
  if (ids.length === 1) return { batchId: ids[0], date };
  return { batchId: { in: ids }, date };
}

export async function loadAttendanceTallies(courseId: string, batchIds: string | readonly string[] | null) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      session: attendanceSessionWhere(courseId, batchIds),
    },
    select: { studentId: true, status: true, session: { select: { categoryId: true } } },
  });

  const tallies: StudentCategoryTallies = new Map();
  for (const row of records) {
    recordInTallies(tallies, row.studentId, row.session.categoryId, row.status);
  }
  return tallies;
}

export async function loadCourseAttendanceCategories(
  courseId: string,
  batchIds: string | readonly string[] | null,
) {
  const ids = batchIds == null ? [] : typeof batchIds === "string" ? [batchIds] : [...batchIds];
  return prisma.sessionCategory.findMany({
    where: {
      sessions: {
        some:
          ids.length === 0
            ? { batch: { courseId } }
            : ids.length === 1
              ? { batchId: ids[0] }
              : { batchId: { in: ids } },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, minAttendancePercent: true },
  });
}
