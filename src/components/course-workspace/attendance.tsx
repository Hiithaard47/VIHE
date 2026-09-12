import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/rbac";
import { resolveTeacherBatchForCourse } from "@/lib/enrollment";
import {
  attendancePercent,
  emptyTally,
  isAtRisk,
  type AttendancePolicy,
} from "@/lib/attendance";
import { loadAttendanceTallies } from "@/lib/course-attendance";
import type { CoursePortal } from "@/lib/course-workspace";

export async function CourseAttendanceView({
  courseId,
  portal,
}: {
  courseId: string;
  portal: CoursePortal;
}) {
  const session = await requireCourseAccess(courseId, portal);
  const batchId = await resolveTeacherBatchForCourse(session.user.id, courseId);

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

  const tallies = await loadAttendanceTallies(courseId, batchId);

  const rows = course.batches
    .flatMap((batch) => batch.enrollments.map((enrollment) => ({ ...enrollment, batchName: batch.name })))
    .map(({ student, batchName }) => {
      const percent = attendancePercent(tallies.get(student.id) ?? emptyTally(), policy);
      return { student, batchName, percent, atRisk: isAtRisk(percent, policy) };
    })
    .sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || a.student.name.localeCompare(b.student.name));
  const showBatchName = course.batches.length > 1;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Attendance &middot; {rows.length} student(s)
      </h2>
      {policy.minAttendancePercent !== null ? (
        <p className="text-xs text-muted">Students below {policy.minAttendancePercent}% are shown in red.</p>
      ) : (
        <p className="text-xs text-muted">No minimum attendance is set for this course.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              {showBatchName && <th className="px-4 py-2 font-medium">Batch</th>}
              <th className="px-4 py-2 font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, batchName, percent, atRisk }) => (
              <tr
                key={student.id}
                className={`border-b border-hairline last:border-0 ${atRisk ? "bg-red-50 text-red-700" : "text-ink"}`}
              >
                <td className="px-4 py-3 font-medium">{student.name}</td>
                <td className="px-4 py-3">{student.rollNumber}</td>
                {showBatchName && <td className="px-4 py-3">{batchName}</td>}
                <td className={`px-4 py-3 ${atRisk ? "font-semibold" : ""}`}>
                  {percent === null ? "—" : `${percent}%`}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showBatchName ? 4 : 3} className="px-4 py-3 text-sm text-muted">
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
