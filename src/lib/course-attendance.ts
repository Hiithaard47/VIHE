import { prisma } from "@/lib/prisma";
import { emptyTally, type StatusTally, type StatusValue } from "@/lib/attendance";
import { startOfTodayUtc } from "@/lib/time";

export async function loadAttendanceTallies(courseId: string, batchId: string | null) {
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: {
      session: batchId
        ? { batchId, date: { lte: startOfTodayUtc() } }
        : { batch: { courseId }, date: { lte: startOfTodayUtc() } },
    },
    _count: { _all: true },
  });

  const tallies = new Map<string, StatusTally>();
  for (const row of grouped) {
    const tally = tallies.get(row.studentId) ?? emptyTally();
    tally[row.status as StatusValue] = row._count._all;
    tallies.set(row.studentId, tally);
  }
  return tallies;
}
