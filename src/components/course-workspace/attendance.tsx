import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/rbac";
import { narrowAssignedBatches, resolveTeacherBatchesForCourse, visibleBatchesWhere } from "@/lib/enrollment";
import {
  attendancePercent,
  categoryAttendancePolicy,
  isAtRisk,
} from "@/lib/attendance";
import { loadAttendanceTallies, loadCourseAttendanceCategories, tallyFor } from "@/lib/course-attendance";
import type { CoursePortal } from "@/lib/course-workspace";

export async function CourseAttendanceView({
  courseId,
  portal,
  selectedBatchId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedBatchId?: string;
}) {
  const session = await requireCourseAccess(courseId, portal);
  const assignedIds = narrowAssignedBatches(
    await resolveTeacherBatchesForCourse(session.user.id, courseId),
    selectedBatchId,
  );

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      batches: {
        where: visibleBatchesWhere(assignedIds),
        include: { enrollments: { include: { student: true }, orderBy: { student: { name: "asc" } } } },
      },
    },
  });
  if (!course) notFound();

  const [categories, tallies] = await Promise.all([
    loadCourseAttendanceCategories(courseId, assignedIds.length ? assignedIds : null),
    loadAttendanceTallies(courseId, assignedIds.length ? assignedIds : null),
  ]);

  const rows = course.batches
    .flatMap((batch) => batch.enrollments.map((enrollment) => ({ ...enrollment, batchName: batch.name })))
    .map(({ student, batchName }) => {
      const percents = categories.map((category) => {
        const policy = categoryAttendancePolicy(course, category);
        const percent = attendancePercent(tallyFor(tallies, student.id, category.id), policy);
        return { category, percent, atRisk: isAtRisk(percent, policy) };
      });
      return {
        student,
        batchName,
        percents,
        atRisk: percents.some((item) => item.atRisk),
      };
    })
    .sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || a.student.name.localeCompare(b.student.name));
  const showBatchName = course.batches.length > 1;
  const thresholdNote = categories
    .filter((category) => category.minAttendancePercent !== null)
    .map((category) => `${category.name} ${category.minAttendancePercent}%`)
    .join(", ");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Attendance &middot; {rows.length} student(s)
      </h2>
      {thresholdNote ? (
        <p className="text-xs text-muted">Students below {thresholdNote} are shown in red.</p>
      ) : (
        <p className="text-xs text-muted">No minimum attendance is set on any session category used here.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              {showBatchName && <th className="px-4 py-2 font-medium">Batch</th>}
              {categories.length > 0 ? (
                categories.map((category) => (
                  <th key={category.id} className="px-4 py-2 font-medium">
                    {category.name}
                  </th>
                ))
              ) : (
                <th className="px-4 py-2 font-medium">Attendance</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, batchName, percents, atRisk }) => (
              <tr
                key={student.id}
                className={`border-b border-hairline last:border-0 ${atRisk ? "bg-red-50 text-red-700" : "text-ink"}`}
              >
                <td className="px-4 py-3 font-medium">{student.name}</td>
                <td className="px-4 py-3">{student.rollNumber}</td>
                {showBatchName && <td className="px-4 py-3">{batchName}</td>}
                {categories.length > 0 ? (
                  percents.map(({ category, percent, atRisk: cellAtRisk }) => (
                    <td key={category.id} className={`px-4 py-3 ${cellAtRisk ? "font-semibold" : ""}`}>
                      {percent === null ? "—" : `${percent}%`}
                    </td>
                  ))
                ) : (
                  <td className="px-4 py-3">—</td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={(showBatchName ? 3 : 2) + Math.max(categories.length, 1)} className="px-4 py-3 text-sm text-muted">
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
