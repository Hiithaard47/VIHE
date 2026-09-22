import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AdminCourseChrome } from "@/components/admin-course-chrome";
import { FlashBanner } from "@/components/flash-banner";
import { toggleCourseActive } from "@/modules/courses/actions";

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
    select: { id: true, name: true, code: true, isActive: true },
  });
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <AdminCourseChrome
        courseId={course.id}
        name={course.name}
        code={course.code}
        isActive={course.isActive}
        action={
          <form action={toggleCourseActive.bind(null, course.id)}>
            <input type="hidden" name="nextActive" value={(!course.isActive).toString()} />
            <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              {course.isActive ? "Archive" : "Restore"}
            </button>
          </form>
        }
      >
        {children}
      </AdminCourseChrome>
    </div>
  );
}
