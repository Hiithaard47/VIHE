import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddBatchDialog } from "@/components/add-batch-dialog";

export default async function AdminCourseBatchesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isActive: true },
  });
  const batches = await prisma.courseBatch.findMany({
    where: { courseId },
    include: {
      teachers: { include: { teacher: true } },
      enrollments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Batches</h2>
          {course?.isActive && <AddBatchDialog courseId={courseId} />}
        </div>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Batch</th>
                <th className="px-4 py-2 font-medium">Teachers</th>
                <th className="px-4 py-2 font-medium">Students</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/courses/${courseId}/batches/${batch.id}`} className="font-medium hover:text-accent-dark">
                      {batch.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {batch.teachers.map(({ teacher }) => teacher.name).join(", ") || <span className="text-muted">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">{batch.enrollments.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
