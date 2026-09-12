import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { updateBatchDetails } from "./actions";

export default async function AdminBatchOverview({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: { name: true, isActive: true, courseId: true },
  });
  if (!batch || batch.courseId !== courseId) notFound();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Overview</h2>
        <form
          action={updateBatchDetails.bind(null, courseId, batchId)}
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
        >
          <label className="flex flex-col gap-1 text-sm text-ink">
            Batch name
            <input name="name" required defaultValue={batch.name} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Save details
          </button>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Batch status</h2>
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
          <span>{batch.isActive ? "Active" : "Archived"}</span>
          <form action={updateBatchDetails.bind(null, courseId, batchId)}>
            <input type="hidden" name="name" value={batch.name} />
            <input type="hidden" name="nextActive" value={(!batch.isActive).toString()} />
            <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
              {batch.isActive ? "Archive" : "Restore"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
