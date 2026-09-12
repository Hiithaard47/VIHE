import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, canConfigureCourse, canManageCourse } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { CourseTabs } from "@/components/course-tabs";
import { FlashBanner } from "@/components/flash-banner";

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, code: true, _count: { select: { enrollments: true } } },
  });
  if (!course) notFound();

  const [canConfigure, canManage] = await Promise.all([
    canConfigureCourse(session, courseId),
    canManageCourse(session, courseId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href="/teacher" className="text-sm text-muted">
          &larr; Courses
        </Link>
        <h1 className="font-heading text-lg font-semibold text-ink">{course.name}</h1>
        <p className="text-sm text-muted">
          {course.code} &middot; {course._count.enrollments} enrolled student(s)
        </p>
        {!canManage && (
          <p className="mt-2 text-xs text-muted">
            View only &mdash; you&apos;re not assigned to teach this course.
          </p>
        )}
      </div>
      <CourseTabs courseId={courseId} canConfigure={canConfigure} />
      {children}
    </div>
  );
}
