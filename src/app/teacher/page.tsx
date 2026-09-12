import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";

export default async function TeacherHome() {
  const session = await auth();
  if (!session) return null;

  const isAdmin = session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE);

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    include: { batches: { where: { isActive: true }, select: { teachers: { select: { teacherId: true } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-semibold text-ink">Courses</h1>
      <p className="text-sm text-muted">
        Every active course is listed here. You can create sessions and mark attendance for courses you&apos;re
        assigned to; others are view-only.
      </p>
      {courses.length === 0 && <p className="text-sm text-muted">No courses yet.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courses.map((course) => {
          const assigned = isAdmin || course.batches.some((batch) => batch.teachers.some((t) => t.teacherId === session.user.id));
          return (
            <Link
              key={course.id}
              href={`/teacher/courses/${course.id}`}
              className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
            >
              <div className="flex items-center justify-between">
                <p className="font-heading font-medium text-ink">{course.name}</p>
                {assigned && (
                  <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-accent">Assigned</span>
                )}
              </div>
              <p className="text-xs text-muted">{course.code}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
