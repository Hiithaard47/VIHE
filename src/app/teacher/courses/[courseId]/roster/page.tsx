import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canConfigureCourse, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { startOfTodayUtc } from "@/lib/time";
import {
  attendancePercent,
  emptyTally,
  isAtRisk,
  type AttendancePolicy,
  type StatusTally,
  type StatusValue,
} from "@/lib/attendance";
import { enrollStudent, unenrollStudent } from "./actions";

export default async function CourseRosterPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);
  const canConfigure = await canConfigureCourse(session, courseId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      minAttendancePercent: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
    },
  });
  if (!course) notFound();

  const policy: AttendancePolicy = {
    minAttendancePercent: course.minAttendancePercent,
    lateCountsAsAttended: course.lateCountsAsAttended,
    excusedCountsAsAttended: course.excusedCountsAsAttended,
  };

  // One grouped query for every student's per-status counts across the
  // course's past sessions.
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: { session: { courseId, date: { lt: startOfTodayUtc() } } },
    _count: { _all: true },
  });

  const tallies = new Map<string, StatusTally>();
  for (const row of grouped) {
    const tally = tallies.get(row.studentId) ?? emptyTally();
    tally[row.status as StatusValue] = row._count._all;
    tallies.set(row.studentId, tally);
  }

  const enrolledIds = course.enrollments.map((e) => e.studentId);
  const available = canConfigure
    ? await prisma.student.findMany({
        where: { isActive: true, id: { notIn: enrolledIds } },
        orderBy: { rollNumber: "asc" },
      })
    : [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Roster &middot; {course.enrollments.length} student(s)
      </h2>
      {policy.minAttendancePercent !== null && (
        <p className="text-xs text-muted">
          Threshold {policy.minAttendancePercent}% &mdash; set in Settings &rsaquo; Attendance policy.
        </p>
      )}
      {canConfigure && (
        <form
          action={enrollStudent.bind(null, courseId)}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-card p-4"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Add a student
            <select
              name="studentId"
              required
              defaultValue=""
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                Select a student…
              </option>
              {available.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.rollNumber} — {student.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Enroll
          </button>
        </form>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Attendance</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {course.enrollments.map(({ student }) => {
              const percent = attendancePercent(tallies.get(student.id) ?? emptyTally(), policy);
              const atRisk = isAtRisk(percent, policy);
              return (
                <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">{student.rollNumber}</td>
                  <td className="px-4 py-3">{student.name}</td>
                  <td className={`px-4 py-3 ${atRisk ? "font-semibold text-red-700" : ""}`}>
                    {percent === null ? "—" : `${percent}%`}
                  </td>
                  <td className="px-4 py-3">
                    {atRisk ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        At risk
                      </span>
                    ) : (
                      <span className="text-xs text-muted">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canConfigure && (
                      <form action={unenrollStudent.bind(null, courseId)}>
                        <input type="hidden" name="studentId" value={student.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted underline hover:text-accent-dark"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {course.enrollments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm text-muted">
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
