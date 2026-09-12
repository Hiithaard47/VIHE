import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AdminCourseTabs } from "@/components/admin-course-tabs";
import { FlashBanner } from "@/components/flash-banner";

export default async function AdminCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, code: true },
  });
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href="/admin/courses" className="text-sm text-muted">
          &larr; Courses
        </Link>
        <h1 className="font-heading text-lg font-semibold text-ink">{course.name}</h1>
        <p className="text-sm text-muted">{course.code}</p>
      </div>
      <AdminCourseTabs courseId={course.id} />
      {children}
    </div>
  );
}
