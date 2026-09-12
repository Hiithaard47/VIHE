import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";

export default async function StudentHome() {
  const session = await requireStudent();
  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: session.user.id, batch: { isActive: true, course: { isActive: true } } },
    include: {
      batch: {
        include: {
          course: { select: { name: true, code: true } },
          sessions: {
            orderBy: { date: "desc" },
            include: { resources: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const sessions = enrollments.flatMap(({ batch }) =>
    batch.sessions
      .filter((classSession) => classSession.resources.length > 0)
      .map((classSession) => ({
        ...classSession,
        courseName: batch.course.name,
        courseCode: batch.course.code,
        batchName: batch.name,
      })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-ink">Session files</h1>
        <p className="text-sm text-muted">PDFs and images from class sessions in your batches.</p>
      </div>
      {sessions.length === 0 && <p className="text-sm text-muted">No files have been shared yet.</p>}
      {sessions.map((classSession) => (
        <section key={classSession.id} className="flex flex-col gap-3">
          <div>
            <h2 className="font-heading font-medium text-ink">
              {classSession.courseName} · {formatDisplayDate(classSession.date)}
            </h2>
            <p className="text-xs text-muted">
              {classSession.courseCode} · {classSession.batchName}
              {classSession.topic ? ` · ${classSession.topic}` : ""}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">File</th>
                </tr>
              </thead>
              <tbody>
                {classSession.resources.map((resource) => (
                  <tr key={resource.id} className="border-b border-hairline text-ink last:border-0">
                    <td className="px-4 py-3">
                      <a href={`/resources/${resource.id}`} className="font-medium hover:text-accent-dark">
                        {resource.fileName}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
