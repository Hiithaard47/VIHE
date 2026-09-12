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
    select: { id: true, name: true, isActive: true, courseId: true, course: { select: { name: true } } },
  });
  if (!batch || batch.courseId !== courseId) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href={`/admin/courses/${courseId}`} className="text-sm text-muted">
          &larr; {batch.course.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-lg font-semibold text-ink">{batch.name}</h1>
          <span className={batch.isActive ? "text-xs text-emerald-700" : "text-xs text-muted"}>
            {batch.isActive ? "Active" : "Archived"}
          </span>
        </div>
      </div>
      <AdminBatchTabs courseId={courseId} batchId={batchId} />
      {children}
    </div>
  );
}
