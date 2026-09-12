import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";

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
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: { include: { batch: { include: { course: true } } } },
    },
  });
  if (!student) notFound();

  const enrollments = student.enrollments
    .filter(({ batch }) => (tab === "active" ? batch.course.isActive : !batch.course.isActive))
    .sort((a, b) => a.batch.course.name.localeCompare(b.batch.course.name));

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
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Batch</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map(({ batch }) => (
              <tr key={batch.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/courses/${batch.course.id}`} className="font-heading font-medium hover:text-accent-dark">
                    {batch.course.name}
                  </Link>
                  <p className="text-xs text-muted">{batch.course.code}</p>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/courses/${batch.course.id}/batches/${batch.id}`}
                    className="hover:text-accent-dark"
                  >
                    {batch.name}
                  </Link>
                  {!batch.isActive && <p className="text-xs text-muted">Archived batch</p>}
                </td>
              </tr>
            ))}
            {enrollments.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm text-muted">
                  {tab === "active" ? "Not enrolled in an active course." : "No completed courses."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
