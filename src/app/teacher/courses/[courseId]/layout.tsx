import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canConfigureCourse, requireCourseAccess } from "@/lib/rbac";
import { CourseTabs } from "@/components/course-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { TeacherCourseHeading } from "@/components/teacher-course-heading";
import { resolveCourseScope } from "@/lib/batch-scope";

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
      batches: {
        where: { isActive: true },
        select: { id: true, name: true, _count: { select: { enrollments: true } } },
      },
    },
  });
  if (!course) notFound();

  const canConfigure = await canConfigureCourse(session, courseId);
  const scope = await resolveCourseScope(session, courseId);
  const headingBatches = course.batches
    .filter((batch) => scope?.kind === "all" || Boolean(scope?.ids.includes(batch.id)))
    .map((batch) => ({ id: batch.id, name: batch.name, enrolled: batch._count.enrollments }));

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href="/teacher" className="text-sm text-muted">
          &larr; Courses
        </Link>
        <Suspense>
          <TeacherCourseHeading name={course.name} code={course.code} batches={headingBatches} />
        </Suspense>
        {!course.isActive && (
          <p className="mt-2 text-xs text-muted">
            This course is archived. An admin can restore it to make changes.
          </p>
        )}
      </div>
      <Suspense>
        <CourseTabs courseId={courseId} canConfigure={canConfigure} />
      </Suspense>
      {children}
    </div>
  );
}
