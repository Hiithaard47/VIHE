import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { FlashBanner } from "@/components/flash-banner";
import { createCourse } from "./actions";

export default async function CoursesPage() {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const courses = await prisma.course.findMany({
    include: { batches: { include: { enrollments: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add course</h2>
        <form action={createCourse} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input name="name" placeholder="Course name" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="code" placeholder="Course code (unique)" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="description" placeholder="Description (optional)" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </div>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Create course
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Courses</h2>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Batches</th>
                <th className="px-4 py-2 font-medium">Students</th>
                <th className="px-4 py-2 font-medium">Status</th>
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
                    <td className="px-4 py-3">
                      <span className={course.isActive ? "text-ink" : "text-muted"}>
                        {course.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
