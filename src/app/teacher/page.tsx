import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function TeacherHome() {
  const session = await auth();
  if (!session) return null;

  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      batches: { some: { isActive: true, teachers: { some: { teacherId: session.user.id } } } },
    },
    select: {
      id: true,
      name: true,
      code: true,
      batches: {
        where: { isActive: true, teachers: { some: { teacherId: session.user.id } } },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, _count: { select: { enrollments: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-semibold text-ink">Courses</h1>
      <p className="text-sm text-muted">Courses and batches you are assigned to teach.</p>
      {courses.length === 0 && <p className="text-sm text-muted">No courses assigned yet.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courses.map((course) => (
          <article
            key={course.id}
            aria-labelledby={`course-${course.id}`}
            className="rounded-lg border border-hairline bg-card p-4"
          >
            <h2 id={`course-${course.id}`} className="font-heading font-medium text-ink">
              {course.name}
            </h2>
            <p className="text-xs text-muted">{course.code}</p>
            <ul className="mt-3 flex flex-col gap-1">
              {course.batches.map((batch) => (
                <li key={batch.id}>
                  <Link
                    href={`/teacher/courses/${course.id}?batch=${batch.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-ink hover:bg-canvas"
                  >
                    <span>{batch.name}</span>
                    <span className="text-xs text-muted">
                      {batch._count.enrollments} enrolled
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
