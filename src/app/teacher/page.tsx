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
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-semibold text-ink">Courses</h1>
      <p className="text-sm text-muted">Courses you are assigned to teach.</p>
      {courses.length === 0 && <p className="text-sm text-muted">No courses assigned yet.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/teacher/courses/${course.id}`}
            className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
          >
            <p className="font-heading font-medium text-ink">{course.name}</p>
            <p className="text-xs text-muted">{course.code}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
