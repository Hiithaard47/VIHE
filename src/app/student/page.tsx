import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { studentEnrollmentWhere } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";

export default async function StudentHome() {
  const session = await requireStudent();
  const enrollments = await prisma.courseEnrollment.findMany({
    where: studentEnrollmentWhere(session.user.id),
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          isActive: true,
          subjects: { select: { _count: { select: { sessions: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  enrollments.sort((a, b) => a.course.name.localeCompare(b.course.name));
  const active = enrollments.filter(({ course }) => course.isActive);
  const completed = enrollments.filter(({ course }) => !course.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-ink">My courses</h1>
        <p className="text-sm text-muted">Open a course to see every session.</p>
      </div>
      {enrollments.length === 0 && <p className="text-sm text-muted">You are not enrolled in a course yet.</p>}
      {enrollments.length > 0 && (
        <>
          <CourseGroup title="Active" courses={active} empty="No active courses." />
          <CourseGroup title="Completed" courses={completed} empty="No completed courses." />
        </>
      )}
    </div>
  );
}

function CourseGroup({
  title,
  courses,
  empty,
}: {
  title: string;
  courses: Array<{
    course: {
      id: string;
      name: string;
      code: string;
      description: string | null;
      isActive: boolean;
      subjects: { _count: { sessions: number } }[];
    };
  }>;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title} &middot; {courses.length}
      </h2>
      {courses.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courses.map(({ course }) => {
          const sessionCount = course.subjects.reduce((total, subject) => total + subject._count.sessions, 0);
          return (
            <Link
              key={course.id}
              href={`/student/courses/${course.id}`}
              className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
            >
              <p className="font-heading font-medium text-ink">{course.name}</p>
              <p className="text-xs text-muted">
                {course.code} · {sessionCount} session(s)
              </p>
              {course.description && <p className="mt-2 text-sm text-ink">{course.description}</p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
