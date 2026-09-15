import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCourseWorkspace } from "@/lib/rbac";
import { hasAttendanceAccess } from "@/lib/permissions";
import {
  attendancePercent,
  categoryAttendancePolicy,
  isAtRisk,
  STATUS_OPTIONS,
  statusLetter,
} from "@/lib/attendance";
import {
  loadAttendanceMatrix,
  loadAttendanceTallies,
  loadCourseAttendanceCategories,
  statusAt,
  tallyFor,
} from "@/lib/course-attendance";
import { attendanceHref, firstTeacherCoursePath, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { groupSessionsByCategory, resolveCategoryTab, sessionCategoryTabs } from "@/lib/session-categories";
import { formatDisplayDate } from "@/lib/time";

export async function CourseAttendanceView({
  courseId,
  portal,
  categoryId,
  selectedSubjectId,
}: {
  courseId: string;
  portal: CoursePortal;
  categoryId?: string;
  selectedSubjectId?: string;
}) {
  const { session, scope } = await loadCourseWorkspace(courseId, portal, selectedSubjectId);
  if (portal === "teacher" && !hasAttendanceAccess(session.user.permissions)) {
    redirect(firstTeacherCoursePath(courseId, session.user.permissions));
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      enrollments: { include: { student: true }, orderBy: { student: { name: "asc" } } },
    },
  });
  if (!course) notFound();

  const [categories, tallies, matrix] = await Promise.all([
    loadCourseAttendanceCategories(courseId, scope),
    loadAttendanceTallies(courseId, scope),
    loadAttendanceMatrix(courseId, scope),
  ]);

  const rows = course.enrollments
    .map(({ student }) => {
      const percents = categories.map((category) => {
        const policy = categoryAttendancePolicy(course, category);
        const percent = attendancePercent(tallyFor(tallies, student.id, category.id), policy);
        return { category, percent, atRisk: isAtRisk(percent, policy) };
      });
      return {
        student,
        percents,
        atRisk: percents.some((item) => item.atRisk),
      };
    })
    .sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || a.student.name.localeCompare(b.student.name));
  const thresholdNote = categories
    .filter((category) => category.minAttendancePercent !== null)
    .map((category) => `${category.name} ${category.minAttendancePercent}%`)
    .join(", ");
  const groups = groupSessionsByCategory(matrix.sessions);
  const tabs = sessionCategoryTabs(groups);
  const selected = resolveCategoryTab(tabs, categoryId);
  const selectedSessions = selected?.sessions ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Attendance &middot; {rows.length} student(s)
        </h2>
        {thresholdNote ? (
          <p className="text-xs text-muted">Students below {thresholdNote} are shown in red.</p>
        ) : (
          <p className="text-xs text-muted">No minimum attendance is set on any session category used here.</p>
        )}
        <div className="max-w-full overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Roll no.</th>
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
              {rows.map(({ student, percents, atRisk }) => (
                <tr
                  key={student.id}
                  className={`border-b border-hairline last:border-0 ${atRisk ? "bg-red-50 text-red-700" : "text-ink"}`}
                >
                  <td className="px-4 py-3 font-medium">{student.name}</td>
                  <td className="px-4 py-3">{student.rollNumber}</td>
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
                  <td colSpan={2 + Math.max(categories.length, 1)} className="px-4 py-3 text-sm text-muted">
                    No students enrolled in this course yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        {tabs.length > 0 && (
          <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
            {tabs.map((tab) => {
              const active = tab.id === selected?.id;
              return (
                <Link
                  key={tab.id}
                  href={attendanceHref(portal, courseId, tab.id, selectedSubjectId)}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                    active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {tab.name}
                  {tab.sessions.length > 0 ? ` · ${tab.sessions.length}` : ""}
                </Link>
              );
            })}
          </nav>
        )}
        <p className="text-xs text-muted">
          {STATUS_OPTIONS.map((option) => `${statusLetter(option.value)} ${option.label}`).join(" · ")}
        </p>
        {!selected || selectedSessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions in this category yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-lg border border-hairline bg-card">
            <table className="w-max min-w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Student</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Roll no.</th>
                  {selectedSessions.map((session) => (
                    <th key={session.id} className="whitespace-nowrap px-3 py-2 text-center font-medium">
                      <Link
                        href={sessionHref(portal, session.id)}
                        title={session.name}
                        className="hover:text-ink"
                      >
                        {formatDisplayDate(session.date)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, atRisk }) => (
                  <tr
                    key={student.id}
                    className={`border-b border-hairline last:border-0 ${atRisk ? "bg-red-50 text-red-700" : "text-ink"}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{student.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{student.rollNumber}</td>
                    {selectedSessions.map((session) => (
                      <td key={session.id} className="whitespace-nowrap px-3 py-3 text-center">
                        {statusLetter(statusAt(matrix.marks, student.id, session.id))}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={2 + selectedSessions.length} className="px-4 py-3 text-sm text-muted">
                      No students enrolled in this course yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
