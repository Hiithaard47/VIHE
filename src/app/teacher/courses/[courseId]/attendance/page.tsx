import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageCourse, requireCourseAccess } from "@/lib/rbac";
import { resolveBatchForCourse } from "@/lib/enrollment";
import { startOfTodayUtc } from "@/lib/time";
import {
  attendancePercent,
  emptyTally,
  isAtRisk,
  type AttendancePolicy,
  type StatusTally,
  type StatusValue,
} from "@/lib/attendance";

export default async function CourseAttendancePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireCourseAccess(courseId);
  const canManage = await canManageCourse(session, courseId);
  const batchId = await resolveBatchForCourse(courseId, session.user.id, canManage);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      minAttendancePercent: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      batches: {
        where: batchId ? { id: batchId } : { isActive: true },
        include: { enrollments: { include: { student: true }, orderBy: { student: { name: "asc" } } } },
      },
    },
  });
  if (!course) notFound();

  const policy: AttendancePolicy = {
    minAttendancePercent: course.minAttendancePercent,
    lateCountsAsAttended: course.lateCountsAsAttended,
    excusedCountsAsAttended: course.excusedCountsAsAttended,
  };

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

  const rows = course.batches
    .flatMap((batch) => batch.enrollments)
    .map(({ student }) => {
      const percent = attendancePercent(tallies.get(student.id) ?? emptyTally(), policy);
      return { student, percent, atRisk: isAtRisk(percent, policy) };
    })
    .sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || a.student.name.localeCompare(b.student.name));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Attendance &middot; {rows.length} student(s)
      </h2>
      {policy.minAttendancePercent !== null ? (
        <p className="text-xs text-muted">
          Students below {policy.minAttendancePercent}% are shown in red.
        </p>
      ) : (
        <p className="text-xs text-muted">No minimum attendance is set for this course.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, percent, atRisk }) => (
              <tr
                key={student.id}
                className={`border-b border-hairline last:border-0 ${atRisk ? "bg-red-50 text-red-700" : "text-ink"}`}
              >
                <td className="px-4 py-3 font-medium">{student.name}</td>
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className={`px-4 py-3 ${atRisk ? "font-semibold" : ""}`}>
                  {percent === null ? "—" : `${percent}%`}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No students enrolled in this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
