import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSubjectTabs } from "@/components/admin-subject-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export default async function AdminSubjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const subject = await prisma.courseSubject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      isActive: true,
      courseId: true,
      course: { select: { name: true, isActive: true } },
    },
  });
  if (!subject || subject.courseId !== courseId) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div className="print:hidden">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link href="/admin/courses" className="hover:text-ink">
            Courses
          </Link>
          <span>/</span>
          <Link href={`/admin/courses/${courseId}`} className="hover:text-ink">
            {subject.course.name}
          </Link>
          <span>/</span>
          <span className="text-ink">{subject.name}</span>
        </nav>
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg font-semibold text-ink">{subject.name}</h1>
            <span className={subject.isActive ? "text-xs text-ink" : "text-xs text-muted"}>
              {subject.isActive ? "Active" : "Archived"}
            </span>
            {!subject.course.isActive && <span className="text-xs text-muted">Course archived</span>}
          </div>
          {!subject.course.isActive && (
            <p className="mt-2 text-sm text-muted">This course is archived. Restore it to make changes.</p>
          )}
        </div>
        <div className="mt-5">
          <AdminSubjectTabs courseId={courseId} subjectId={subjectId} />
        </div>
      </div>
      {children}
    </div>
  );
}
