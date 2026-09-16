import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCourseWorkspace } from "@/lib/rbac";
import { hasStudentsRead } from "@/lib/permissions";
import {
  attendancePercent,
  categoryAttendancePolicy,
  isAtRisk,
} from "@/lib/attendance";
import { loadAttendanceTallies, loadCourseAttendanceCategories, tallyFor } from "@/lib/course-attendance";
import { AddPersonDialog } from "@/components/add-person-autocomplete";
import { enrollStudent, unenrollStudent } from "@/app/teacher/courses/[courseId]/roster/actions";
import { contactKeywords } from "@/lib/admin-list";
import { firstTeacherCoursePath, type CoursePortal } from "@/lib/course-workspace";

export async function CourseRosterView({
  courseId,
  portal,
  selectedSubjectId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedSubjectId?: string;
}) {
  const { session, scope, canConfigure } = await loadCourseWorkspace(courseId, portal, selectedSubjectId);
  if (portal === "teacher" && !hasStudentsRead(session.user.permissions)) {
    redirect(firstTeacherCoursePath(courseId, session.user.permissions));
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
    },
  });
  if (!course) notFound();

  const [categories, tallies] = await Promise.all([
    loadCourseAttendanceCategories(courseId, scope),
    loadAttendanceTallies(courseId, scope),
  ]);

  const rows = course.enrollments;
  const enrolledIds = rows.map((row) => row.studentId);
  const available = canConfigure
    ? await prisma.student.findMany({
        where: { isActive: true, id: { notIn: enrolledIds } },
        orderBy: { rollNumber: "asc" },
      })
    : [];
  const thresholdNote = categories
    .filter((category) => category.minAttendancePercent !== null)
    .map((category) => `${category.name} ${category.minAttendancePercent}%`)
    .join(" · ");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          />
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
            {rows.map(({ student }) => {
              const percents = categories.map((category) => {
                const policy = categoryAttendancePolicy(course, category);
                const percent = attendancePercent(tallyFor(tallies, student.id, category.id), policy);
                return { category, percent, atRisk: isAtRisk(percent, policy) };
              });
              const atRisk = percents.some((item) => item.atRisk);
              return (
                <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
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
                <td colSpan={4 + Math.max(categories.length, 1)} className="px-4 py-3 text-sm text-muted">
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
