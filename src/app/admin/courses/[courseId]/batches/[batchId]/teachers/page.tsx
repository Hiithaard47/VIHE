import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { updateBatchTeachers } from "../actions";

export default async function AdminBatchTeachersPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: { courseId: true, teachers: { select: { teacherId: true } } },
  });
  if (!batch || batch.courseId !== courseId) notFound();
  const [teachers] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const assigned = new Set(batch.teachers.map(({ teacherId }) => teacherId));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Teachers</h2>
      <form action={updateBatchTeachers.bind(null, courseId, batchId)} className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4">
        <fieldset className="flex flex-col gap-3 text-sm text-ink">
          <legend className="mb-1 text-muted">Active users assigned to this batch</legend>
          {teachers.map((teacher) => (
            <label key={teacher.id} className="flex items-start gap-2">
              <input type="checkbox" name="teacherIds" value={teacher.id} defaultChecked={assigned.has(teacher.id)} />
              <span>
                {teacher.name}
                <span className="ml-2 text-xs text-muted">{teacher.email}</span>
              </span>
            </label>
          ))}
          {teachers.length === 0 && <p className="text-sm text-muted">No active users available.</p>}
        </fieldset>
        <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
          Save teachers
        </button>
      </form>
    </section>
  );
}
