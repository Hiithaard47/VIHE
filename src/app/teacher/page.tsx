import Link from "next/link";
import { AdminStatusTabs } from "@/components/admin-status-tabs";
import { ListSearch } from "@/components/list-search";
import { adminListHref, parseAdminListSearch, parseAdminListTab } from "@/lib/admin-list";
import { hasCoursesRead, hasSessionsRead, hasStudentsRead, TEACHER_PORTAL_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

const PATH = "/teacher";

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);
  if (!hasCoursesRead(session.user.permissions) && !hasSessionsRead(session.user.permissions) && hasStudentsRead(session.user.permissions)) {
    redirect("/teacher/students");
  }

  const { tab: rawTab, q: rawQ } = await searchParams;
  const tab = parseAdminListTab(rawTab);
  const q = parseAdminListSearch(rawQ);
  const isActive = tab === "active";

  const courses = await prisma.course.findMany({
    where: {
      isActive,
      subjects: {
        some: {
          ...(isActive ? { isActive: true } : {}),
          teachers: { some: { teacherId: session.user.id } },
        },
      },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      _count: { select: { enrollments: true } },
      subjects: {
        where: {
          ...(isActive ? { isActive: true } : {}),
          teachers: { some: { teacherId: session.user.id } },
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Courses</h2>
        <AdminStatusTabs tab={tab} hrefForTab={(nextTab) => adminListHref(PATH, nextTab, 1, q)} />
        <ListSearch action={PATH} tab={tab} q={q} placeholder="Search by name or code" />
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Subjects</th>
                <th className="px-4 py-2 font-medium">Students</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const studentCount = course._count.enrollments;
                return (
                  <tr key={course.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/teacher/courses/${course.id}`} className="font-heading font-medium hover:text-accent-dark">
                        {course.name}
                      </Link>
                      <p className="text-xs text-muted">{course.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="flex flex-col gap-1">
                        {course.subjects.map((subject) => (
                          <li key={subject.id}>
                            <Link
                              href={`/teacher/courses/${course.id}?subject=${subject.id}`}
                              className="hover:text-accent-dark"
                            >
                              {subject.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">{studentCount}</td>
                  </tr>
                );
              })}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                    {q ? "No matching courses." : isActive ? "No active courses yet." : "No archived courses."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
