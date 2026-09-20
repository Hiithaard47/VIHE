import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddSubjectDialog } from "@/components/add-subject-dialog";

export default async function AdminCourseSubjectsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const [course, subjects] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { isActive: true },
    }),
    prisma.courseSubject.findMany({
      where: { courseId },
      include: {
        teachers: { include: { teacher: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Subjects</h2>
          {course?.isActive && <AddSubjectDialog courseId={courseId} />}
        </div>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Teachers</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr
                  key={subject.id}
                  className={`border-b border-hairline last:border-0 ${subject.isActive ? "text-ink" : "text-muted"}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${courseId}/subjects/${subject.id}`}
                      className={`font-medium hover:text-accent-dark ${subject.isActive ? "" : "text-muted"}`}
                    >
                      {subject.name}
                    </Link>
                    {!subject.isActive && <span className="ml-2 text-xs text-muted">Archived</span>}
                  </td>
                  <td className={`px-4 py-3 ${subject.isActive ? "" : "text-muted"}`}>
                    {subject.teachers.map(({ teacher }) => teacher.name).join(", ") || (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
