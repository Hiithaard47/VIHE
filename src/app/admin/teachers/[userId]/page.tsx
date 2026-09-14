import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export default async function AdminTeacherAssignmentsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      taughtSubjects: {
        include: { subject: { include: { course: { select: { id: true, name: true, code: true } } } } },
        orderBy: { subject: { course: { name: "asc" } } },
      },
    },
  });
  if (!user) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Assignments</h2>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Subject</th>
            </tr>
          </thead>
          <tbody>
            {user.taughtSubjects.map(({ subject }) => (
              <tr key={subject.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/courses/${subject.course.id}`} className="hover:text-accent-dark">
                    {subject.course.name}
                  </Link>
                  <p className="text-xs text-muted">{subject.course.code}</p>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/courses/${subject.course.id}/subjects/${subject.id}`}
                    className="hover:text-accent-dark"
                  >
                    {subject.name}
                  </Link>
                </td>
              </tr>
            ))}
            {user.taughtSubjects.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm text-muted">
                  Not assigned to any subject.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
