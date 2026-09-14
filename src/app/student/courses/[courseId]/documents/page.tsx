import { notFound } from "next/navigation";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function StudentCourseDocumentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  const resources = await prisma.sessionResource.findMany({
    where: { session: { subject: { courseId } } },
    include: { session: { select: { date: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Documents &middot; {resources.length} file(s)
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium">Session</th>
              <th className="px-4 py-2 font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">
                  <a href={`/resources/${resource.id}`} className="font-medium hover:text-accent-dark">
                    {resource.fileName}
                  </a>
                  <p className="text-xs text-muted">{resource.contentType}</p>
                </td>
                <td className="px-4 py-3">
                  {formatDisplayDate(resource.session.date)}
                  <p className="text-xs text-muted">{resource.session.name}</p>
                </td>
                <td className="px-4 py-3 text-muted">{formatSize(resource.sizeBytes)}</td>
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No documents have been shared yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
