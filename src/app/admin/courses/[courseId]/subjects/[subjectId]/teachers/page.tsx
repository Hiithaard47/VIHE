import { notFound } from "next/navigation";
import { AddPersonDialog } from "@/components/add-person-autocomplete";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { addSubjectTeacher, removeSubjectTeacher } from "@/modules/subjects/actions";
import { contactKeywords } from "@/lib/admin-list";

export default async function AdminSubjectTeachersPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const subject = await prisma.courseSubject.findUnique({
    where: { id: subjectId },
    select: {
      courseId: true,
      course: { select: { isActive: true } },
      teachers: {
        include: { teacher: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { teacher: { name: "asc" } },
      },
    },
  });
  if (!subject || subject.courseId !== courseId) notFound();

  const assignedIds = subject.teachers.map(({ teacherId }) => teacherId);
  const available = await prisma.user.findMany({
    where: { isActive: true, id: { notIn: assignedIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, phone: true },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Teachers &middot; {subject.teachers.length} assigned
        </h2>
        {subject.course.isActive && (
          <AddPersonDialog
            people={available.map((teacher) => ({
              id: teacher.id,
              title: teacher.name,
              subtitle: teacher.email,
              keywords: contactKeywords(teacher.phone),
            }))}
            fieldName="teacherId"
            buttonLabel="Add teacher"
            placeholder="Search by name, email, or mobile"
            emptyLabel="No matching teachers."
            action={addSubjectTeacher.bind(null, courseId, subjectId)}
          />
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Teacher</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Mobile</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {subject.teachers.map(({ teacher }) => (
              <tr key={teacher.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{teacher.name}</td>
                <td className="px-4 py-3 text-muted">{teacher.email}</td>
                <td className="px-4 py-3 text-muted">{teacher.phone || "—"}</td>
                <td className="px-4 py-3">
                  {subject.course.isActive && (
                    <form action={removeSubjectTeacher.bind(null, courseId, subjectId)}>
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {subject.teachers.length === 0 && (
              <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-muted">
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
