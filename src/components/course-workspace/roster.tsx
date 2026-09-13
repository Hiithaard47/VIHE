import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { batchWhere } from "@/lib/batch-scope";
import { loadCourseWorkspace } from "@/lib/rbac";
import {
  attendancePercent,
  categoryAttendancePolicy,
  isAtRisk,
} from "@/lib/attendance";
import { loadAttendanceTallies, loadCourseAttendanceCategories, tallyFor } from "@/lib/course-attendance";
import { AddPersonDialog } from "@/components/add-person-autocomplete";
import { BatchField } from "@/components/course-workspace-fields";
import { enrollStudent, unenrollStudent } from "@/app/teacher/courses/[courseId]/roster/actions";
import { contactKeywords } from "@/lib/admin-list";
import type { CoursePortal } from "@/lib/course-workspace";

export async function CourseRosterView({
  courseId,
  portal,
  selectedBatchId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedBatchId?: string;
}) {
  const { scope, canConfigure } = await loadCourseWorkspace(courseId, portal, selectedBatchId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      batches: {
        where: batchWhere(scope),
        select: {
          id: true,
          name: true,
          enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
        },
      },
    },
  });
  if (!course) notFound();

  const [categories, tallies] = await Promise.all([
    loadCourseAttendanceCategories(courseId, scope),
    loadAttendanceTallies(courseId, scope),
  ]);

  const rows = course.batches.flatMap((batch) =>
    batch.enrollments.map((enrollment) => ({
      ...enrollment,
      batchId: batch.id,
      batchName: batch.name,
    })),
  );
  const enrolledIds = rows.map((row) => row.studentId);
  const available = canConfigure
    ? await prisma.student.findMany({
        where: { isActive: true, id: { notIn: enrolledIds } },
        orderBy: { rollNumber: "asc" },
      })
    : [];
  const writableBatches = course.batches.map((batch) => ({ id: batch.id, name: batch.name }));
  const showBatchName = course.batches.length > 1;
  const thresholdNote = categories
    .filter((category) => category.minAttendancePercent !== null)
    .map((category) => `${category.name} ${category.minAttendancePercent}%`)
    .join(" · ");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Roster &middot; {rows.length} student(s)
        </h2>
        {canConfigure && (
          <AddPersonDialog
            people={available.map((student) => ({
              id: student.id,
              title: student.name,
              subtitle: student.rollNumber,
              keywords: contactKeywords(student.email, student.phone),
            }))}
            fieldName="studentId"
            buttonLabel="Add student"
            placeholder="Search by name, roll number, email, or mobile"
            emptyLabel="No matching students."
            action={enrollStudent.bind(null, courseId, portal)}
          >
            <BatchField batches={writableBatches} />
          </AddPersonDialog>
        )}
      </div>
      {thresholdNote ? (
        <p className="text-xs text-muted">
          Threshold {thresholdNote} &mdash; set in Admin › Session categories.
        </p>
      ) : (
        <p className="text-xs text-muted">No minimum attendance is set on any session category used here.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Student</th>
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
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, batchId: studentBatchId, batchName }) => {
              const percents = categories.map((category) => {
                const policy = categoryAttendancePolicy(course, category);
                const percent = attendancePercent(tallyFor(tallies, student.id, category.id), policy);
                return { category, percent, atRisk: isAtRisk(percent, policy) };
              });
              const atRisk = percents.some((item) => item.atRisk);
              return (
                <tr key={`${studentBatchId}-${student.id}`} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">{student.rollNumber}</td>
                  <td className="px-4 py-3">
                    {portal === "admin" ? (
                      <Link href={`/admin/students/${student.id}`} className="font-medium hover:text-accent-dark">
                        {student.name}
                      </Link>
                    ) : (
                      student.name
                    )}
                  </td>
                  {showBatchName && <td className="px-4 py-3 text-muted">{batchName}</td>}
                  {categories.length > 0 ? (
                    percents.map(({ category, percent, atRisk: cellAtRisk }) => (
                      <td
                        key={category.id}
                        className={`px-4 py-3 ${cellAtRisk ? "font-semibold text-red-700" : ""}`}
                      >
                        {percent === null ? "—" : `${percent}%`}
                      </td>
                    ))
                  ) : (
                    <td className="px-4 py-3">—</td>
                  )}
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
                      <form action={unenrollStudent.bind(null, courseId, portal)}>
                        <input type="hidden" name="studentId" value={student.id} />
                        <input type="hidden" name="batchId" value={studentBatchId} />
                        <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={(showBatchName ? 5 : 4) + Math.max(categories.length, 1)} className="px-4 py-3 text-sm text-muted">
                  No students enrolled in this batch yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
