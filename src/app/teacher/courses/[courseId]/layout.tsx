import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canConfigureCourse, requireCourseAccess } from "@/lib/rbac";
import { CourseTabs } from "@/components/course-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { TeacherCourseHeading } from "@/components/teacher-course-heading";
import { resolveCourseScope } from "@/lib/subject-scope";
import { teacherCourseTabSlugs } from "@/lib/course-workspace";

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
      id: true,
      name: true,
      code: true,
      isActive: true,
      subjects: {
        where: { isActive: true },
        select: { id: true, name: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  const canConfigure = await canConfigureCourse(session, courseId);
  const slugs = teacherCourseTabSlugs(session.user.permissions, canConfigure);
  const scope = await resolveCourseScope(session, courseId);
  const headingSubjects = course.subjects
    .filter((subject) => scope?.kind === "all" || Boolean(scope?.ids.includes(subject.id)))
    .map((subject) => ({ id: subject.id, name: subject.name }));

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div className="print:hidden">
        <Link href="/teacher" className="text-sm text-muted">
          &larr; Courses
        </Link>
        <Suspense>
          <TeacherCourseHeading
            name={course.name}
            code={course.code}
            subjects={headingSubjects}
            enrolledCount={course._count.enrollments}
          />
        </Suspense>
        {!course.isActive && (
          <p className="mt-2 text-xs text-muted">
            This course is archived. An admin can restore it to make changes.
          </p>
        )}
      </div>
      <div className="print:hidden">
        <Suspense>
          <CourseTabs courseId={courseId} slugs={slugs} />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
