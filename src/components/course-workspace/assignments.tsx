import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { batchWhere, sessionWhere } from "@/lib/batch-scope";
import { loadCourseWorkspace } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";
import { createAssignment } from "@/app/teacher/courses/[courseId]/assignments/actions";
import { BatchField } from "@/components/course-workspace-fields";
import { courseHref, firstTeacherCoursePath, type CoursePortal } from "@/lib/course-workspace";
import { hasCoursesRead } from "@/lib/permissions";

export async function CourseAssignmentsView({
  courseId,
  portal,
  selectedBatchId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedBatchId?: string;
}) {
  const { session, scope, canManage } = await loadCourseWorkspace(courseId, portal, selectedBatchId);
  if (portal === "teacher" && !hasCoursesRead(session.user.permissions)) {
    redirect(firstTeacherCoursePath(courseId, session.user.permissions));
  }

  const [assignments, writableBatches] = await Promise.all([
    prisma.assignment.findMany({
    where: sessionWhere(courseId, scope),
    include: {
      _count: { select: { submissions: true } },
      submissions: { select: { marks: true } },
      batch: { select: { name: true, _count: { select: { enrollments: true } } } },
    },
    orderBy: { createdAt: "desc" },
    }),
    prisma.courseBatch.findMany({
      where: { courseId, ...batchWhere(scope) },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const showBatchName = new Set(assignments.map((item) => item.batch.name)).size > 1;

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Issue assignment</h2>
          <form action={createAssignment.bind(null, courseId, portal)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
            <BatchField batches={writableBatches} />
            <label className="flex flex-col gap-1 text-sm text-ink">
              Title
              <input name="title" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Due date (optional)
                <input type="date" name="dueDate" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Maximum marks
                <input name="maxMarks" type="number" min={1} defaultValue={100} required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Instructions (optional)
              <textarea name="instructions" rows={3} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Assignment test (PDF or image)
              <input
                name="file"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
              />
            </label>
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
              Issue assignment
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Assignments &middot; {assignments.length}
        </h2>
        <div className="flex flex-col gap-2">
          {assignments.length === 0 && <p className="text-sm text-muted">No assignments issued yet.</p>}
          {assignments.map((assignment) => {
            const graded = assignment.submissions.filter((item) => item.marks !== null).length;
            return (
              <Link
                key={assignment.id}
                href={courseHref(portal, courseId, `assignments/${assignment.id}`, selectedBatchId)}
                className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
              >
                <p className="font-medium text-ink">{assignment.title}</p>
                <p className="text-xs text-muted">
                  {showBatchName ? `${assignment.batch.name} · ` : ""}
                  {assignment.dueDate ? `Due ${formatDisplayDate(assignment.dueDate)} · ` : ""}
                  {assignment._count.submissions}/{assignment.batch._count.enrollments} submitted · {graded} graded
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
