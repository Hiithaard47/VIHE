import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { enrollBatchStudent, unenrollBatchStudent } from "../actions";

export default async function AdminBatchRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { courseId, batchId } = await params;
  const { q = "" } = await searchParams;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: {
      courseId: true,
      enrollments: {
        include: { student: true },
        orderBy: { student: { rollNumber: "asc" } },
      },
    },
  });
  if (!batch || batch.courseId !== courseId) notFound();
  const enrolledIds = batch.enrollments.map(({ studentId }) => studentId);
  const available = await prisma.student.findMany({
    where: {
      isActive: true,
      id: { notIn: enrolledIds },
      ...(q.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: "insensitive" } },
              { rollNumber: { contains: q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { rollNumber: "asc" },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Roster &middot; {batch.enrollments.length} student(s)
      </h2>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-card p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          Find a student to add
          <input name="q" defaultValue={q} placeholder="Name or roll number" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
        </label>
        <button type="submit" className="rounded-md border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas">
          Search
        </button>
      </form>
      <form action={enrollBatchStudent.bind(null, courseId, batchId)} className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-card p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          Add a student
          <select name="studentId" required defaultValue="" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink">
            <option value="" disabled>Select a student…</option>
            {available.map((student) => (
              <option key={student.id} value={student.id}>{student.rollNumber} — {student.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">Enroll</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr><th className="px-4 py-2 font-medium">Roll no.</th><th className="px-4 py-2 font-medium">Student</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {batch.enrollments.map(({ student }) => (
              <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">{student.name}</td>
                <td className="px-4 py-3">
                  <form action={unenrollBatchStudent.bind(null, courseId, batchId)}>
                    <input type="hidden" name="studentId" value={student.id} />
                    <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {batch.enrollments.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-3 text-sm text-muted">No students enrolled in this batch yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
