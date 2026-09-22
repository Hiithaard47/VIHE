import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { updateStudentEnrollments } from "@/modules/students/actions";

type CourseTab = "active" | "completed";

function parseCourseTab(value: string | undefined): CourseTab {
  return value === "completed" ? "completed" : "active";
}

export default async function AdminStudentCoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { studentId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = parseCourseTab(rawTab);
  await requireAnyPermission([PERMISSIONS.STUDENTS_MANAGE, PERMISSIONS.COURSES_MANAGE]);
  const [student, courses] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: { include: { course: true } },
      },
    }),
    prisma.course.findMany({
      where: tab === "active" ? { isActive: true } : { isActive: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    }),
  ]);
  if (!student) notFound();

  const enrolledCourseIds = new Set(student.enrollments.map((e) => e.courseId));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Courses</h2>
      <nav className="-mb-px flex gap-1 border-b border-hairline">
        {(
          [
            { slug: "active", label: "Active", href: `/admin/students/${studentId}` },
            { slug: "completed", label: "Completed", href: `/admin/students/${studentId}?tab=completed` },
          ] as const
        ).map((item) => {
          const active = item.slug === tab;
          return (
            <Link
              key={item.slug}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {student.isActive ? (
        <form action={updateStudentEnrollments.bind(null, studentId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <fieldset className="flex flex-col gap-2 text-sm">
            {courses.map((course) => (
              <label key={course.id} className="flex items-center gap-2">
                <input type="hidden" name="visibleCourse" value={course.id} />
                <input
                  type="checkbox"
                  name={`course-${course.id}`}
                  defaultChecked={enrolledCourseIds.has(course.id)}
                  className="rounded border-hairline"
                />
                <span>
                  {course.name} <span className="text-muted">({course.code})</span>
                </span>
              </label>
            ))}
            {courses.length === 0 && <p className="text-sm text-muted">No courses in this tab.</p>}
          </fieldset>
          {courses.length > 0 && (
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              Save enrollment
            </button>
          )}
        </form>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Course</th>
              </tr>
            </thead>
            <tbody>
              {student.enrollments
                .filter(({ course }) => (tab === "active" ? course.isActive : !course.isActive))
                .map(({ course }) => (
                  <tr key={course.id} className="border-b border-hairline text-ink last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/courses/${course.id}`} className="font-heading font-medium hover:text-accent-dark">
                        {course.name}
                      </Link>
                      <p className="text-xs text-muted">{course.code}</p>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
