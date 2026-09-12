import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canConfigureCourse, requireCourseAccess } from "@/lib/rbac";
import { CourseTabs } from "@/components/course-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { resolveTeacherBatchForCourse } from "@/lib/enrollment";

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireCourseAccess(courseId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true, name: true, code: true, isActive: true,
      batches: { where: { isActive: true }, select: { id: true, _count: { select: { enrollments: true } } } },
    },
  });
  if (!course) notFound();

  const canConfigure = await canConfigureCourse(session, courseId);
  const batchId = await resolveTeacherBatchForCourse(session.user.id, courseId);
  const enrolledCount = batchId
    ? course.batches.find((batch) => batch.id === batchId)?._count.enrollments ?? 0
    : course.batches.reduce((total, batch) => total + batch._count.enrollments, 0);

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href="/teacher" className="text-sm text-muted">
          &larr; Courses
        </Link>
        <h1 className="font-heading text-lg font-semibold text-ink">{course.name}</h1>
        <p className="text-sm text-muted">
          {course.code} &middot; {enrolledCount} enrolled student(s)
        </p>
        {!course.isActive && (
          <p className="mt-2 text-xs text-muted">
            This course is archived. An admin can restore it to make changes.
          </p>
        )}
      </div>
      <CourseTabs courseId={courseId} canConfigure={canConfigure} />
      {children}
    </div>
  );
}
