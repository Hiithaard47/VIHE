import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBatchTabs } from "@/components/admin-batch-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export default async function AdminBatchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      isActive: true,
      courseId: true,
      course: { select: { name: true, isActive: true } },
    },
  });
  if (!batch || batch.courseId !== courseId) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/admin/courses" className="hover:text-ink">
          Courses
        </Link>
        <span>/</span>
        <Link href={`/admin/courses/${courseId}`} className="hover:text-ink">
          {batch.course.name}
        </Link>
        <span>/</span>
        <span className="text-ink">{batch.name}</span>
      </nav>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-lg font-semibold text-ink">{batch.name}</h1>
          <span className={batch.isActive ? "text-xs text-ink" : "text-xs text-muted"}>
            {batch.isActive ? "Active" : "Archived"}
          </span>
          {!batch.course.isActive && <span className="text-xs text-muted">Course archived</span>}
        </div>
        {!batch.course.isActive && (
          <p className="mt-2 text-sm text-muted">This course is archived. Restore it to make changes.</p>
        )}
      </div>
      <AdminBatchTabs courseId={courseId} batchId={batchId} />
      {children}
    </div>
  );
}
