import Link from "next/link";
import { ListPagination } from "@/components/list-pagination";
import { ADMIN_PAGE_SIZE, parseAdminListPage } from "@/lib/admin-list";
import { prisma } from "@/lib/prisma";

function dashboardHref(page: number) {
  return page > 1 ? `/admin?page=${page}` : "/admin";
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const [teacherCount, courseCount, studentCount, roleCount, activeCourseCount] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.student.count(),
    prisma.role.count(),
    prisma.course.count({ where: { isActive: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(activeCourseCount / ADMIN_PAGE_SIZE));
  const page = parseAdminListPage(rawPage, totalPages);
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    include: { batches: { include: { enrollments: true } } },
    orderBy: { name: "asc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  const stats = [
    { label: "Users", value: teacherCount },
    { label: "Courses", value: courseCount },
    { label: "Students", value: studentCount },
    { label: "Roles", value: roleCount },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-hairline bg-card p-4">
            <p className="font-heading text-2xl font-semibold text-ink">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Active courses</h2>
          <Link href="/admin/courses" className="text-xs text-muted underline hover:text-accent-dark">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Batches</th>
                <th className="px-4 py-2 font-medium">Students</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const enrolled = course.batches.reduce((total, batch) => total + batch.enrollments.length, 0);
                return (
                  <tr key={course.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/courses/${course.id}`} className="font-heading font-medium hover:text-accent-dark">
                        {course.name}
                      </Link>
                      <p className="text-xs text-muted">{course.code}</p>
                    </td>
                    <td className="px-4 py-3">{course.batches.length}</td>
                    <td className="px-4 py-3">{enrolled}</td>
                  </tr>
                );
              })}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                    No active courses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPagination page={page} totalPages={totalPages} hrefForPage={dashboardHref} />
      </section>
    </div>
  );
}
