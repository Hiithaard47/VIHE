import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AddCourseDialog } from "@/components/add-course-dialog";
import { AdminStatusTabs } from "@/components/admin-status-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import {
  ADMIN_PAGE_SIZE,
  adminListHref,
  parseAdminListPage,
  parseAdminListSearch,
  parseAdminListTab,
} from "@/lib/admin-list";

const PATH = "/admin/courses";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const { tab: rawTab, page: rawPage, q: rawQ } = await searchParams;
  const tab = parseAdminListTab(rawTab);
  const q = parseAdminListSearch(rawQ);
  const isActive = tab === "active";
  const where = {
    isActive,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.course.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = parseAdminListPage(rawPage, totalPages);

  const courses = await prisma.course.findMany({
    where,
    include: { batches: { include: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Courses</h2>
          {isActive && <AddCourseDialog />}
        </div>
        <AdminStatusTabs tab={tab} hrefForTab={(nextTab) => adminListHref(PATH, nextTab, 1, q)} />
        <ListSearch action={PATH} tab={tab} q={q} placeholder="Search by name or code" />
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
                const studentCount = course.batches.reduce((total, batch) => total + batch.enrollments.length, 0);
                return (
                  <tr key={course.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/courses/${course.id}`} className="font-heading font-medium hover:text-accent-dark">
                        {course.name}
                      </Link>
                      <p className="text-xs text-muted">{course.code}</p>
                    </td>
                    <td className="px-4 py-3">{course.batches.length}</td>
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
        <ListPagination page={page} totalPages={totalPages} hrefForPage={(nextPage) => adminListHref(PATH, tab, nextPage, q)} />
      </section>
    </div>
  );
}
