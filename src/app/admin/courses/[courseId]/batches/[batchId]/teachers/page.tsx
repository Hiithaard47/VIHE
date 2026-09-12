import { notFound } from "next/navigation";
import { AddPersonDialog } from "@/components/add-person-autocomplete";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { addBatchTeacher, removeBatchTeacher } from "../actions";

export default async function AdminBatchTeachersPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: {
      courseId: true,
      course: { select: { isActive: true } },
      teachers: {
        include: { teacher: { select: { id: true, name: true, email: true } } },
        orderBy: { teacher: { name: "asc" } },
      },
    },
  });
  if (!batch || batch.courseId !== courseId) notFound();

  const assignedIds = batch.teachers.map(({ teacherId }) => teacherId);
  const available = await prisma.user.findMany({
    where: { isActive: true, id: { notIn: assignedIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Teachers &middot; {batch.teachers.length} assigned
        </h2>
        {batch.course.isActive && (
          <AddPersonDialog
            people={available.map((teacher) => ({
              id: teacher.id,
              title: teacher.name,
              subtitle: teacher.email,
            }))}
            fieldName="teacherId"
            buttonLabel="Add teacher"
            placeholder="Search by name or email"
            emptyLabel="No matching teachers."
            action={addBatchTeacher.bind(null, courseId, batchId)}
          />
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Teacher</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {batch.teachers.map(({ teacher }) => (
              <tr key={teacher.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{teacher.name}</td>
                <td className="px-4 py-3 text-muted">{teacher.email}</td>
                <td className="px-4 py-3">
                  {batch.course.isActive && (
                    <form action={removeBatchTeacher.bind(null, courseId, batchId)}>
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {batch.teachers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No teachers assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
