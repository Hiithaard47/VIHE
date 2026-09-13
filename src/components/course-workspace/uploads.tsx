import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageCourse, requireCourseAccess } from "@/lib/rbac";
import { narrowAssignedBatches, resolveTeacherBatchesForCourse, scopedSessionWhere } from "@/lib/enrollment";
import { deleteSessionResource } from "@/app/teacher/sessions/[sessionId]/actions";
import { courseHref, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { formatDisplayDate } from "@/lib/time";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function CourseUploadsView({
  courseId,
  portal,
  selectedBatchId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedBatchId?: string;
}) {
  const session = await requireCourseAccess(courseId, portal);
  const canManage = await canManageCourse(session, courseId);
  const assignedIds = narrowAssignedBatches(
    await resolveTeacherBatchesForCourse(session.user.id, courseId),
    selectedBatchId,
  );
  const returnTo = courseHref(portal, courseId, "uploads", selectedBatchId);

  const resources = await prisma.sessionResource.findMany({
    where: { session: scopedSessionWhere(courseId, assignedIds) },
    include: { session: { select: { id: true, date: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Uploads &middot; {resources.length} file(s)
      </h2>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium">Session</th>
              <th className="px-4 py-2 font-medium">Size</th>
              {canManage && <th className="px-4 py-2" />}
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
                  <Link href={sessionHref(portal, resource.session.id)} className="hover:text-accent-dark">
                    {formatDisplayDate(resource.session.date)}
                  </Link>
                  <p className="text-xs text-muted">{resource.session.name}</p>
                </td>
                <td className="px-4 py-3 text-muted">{formatSize(resource.sizeBytes)}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <form action={deleteSessionResource.bind(null, resource.session.id, resource.id, portal)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                        Remove
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-4 py-3 text-sm text-muted">
                  No files uploaded for this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
