import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createBatch } from "./actions";

export default async function AdminCourseBatchesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add batch</h2>
        <form action={createBatch.bind(null, courseId)} className="flex gap-3 rounded-lg border border-hairline bg-card p-4">
          <input
            name="name"
            placeholder="Batch name"
            required
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
          />
          <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Add batch
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Batches</h2>
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
