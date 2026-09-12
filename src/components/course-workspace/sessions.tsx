import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageCourse, requireCourseAccess } from "@/lib/rbac";
import { resolveTeacherBatchForCourse } from "@/lib/enrollment";
import { SessionActionsMenu } from "@/components/session-actions-menu";
import { BatchField } from "@/components/course-workspace-fields";
import { courseHref, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { formatDisplayDate, isFutureSessionDate } from "@/lib/time";
import { createSession } from "@/app/teacher/courses/[courseId]/actions";

export async function CourseSessionsView({
  courseId,
  portal,
}: {
  courseId: string;
  portal: CoursePortal;
}) {
  const session = await requireCourseAccess(courseId, portal);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      description: true,
      batches: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          sessions: { orderBy: { date: "desc" }, include: { _count: { select: { records: true } } } },
        },
      },
    },
  });
  if (!course) notFound();

  const canManage = await canManageCourse(session, courseId);
  const batchId = await resolveTeacherBatchForCourse(session.user.id, courseId);
  const visibleBatches = course.batches.filter((batch) => !batchId || batch.id === batchId);
  const sessions = visibleBatches
    .flatMap((batch) => batch.sessions.map((item) => ({ ...item, batchName: batch.name })))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const writableBatches = visibleBatches.map((batch) => ({ id: batch.id, name: batch.name }));
  const showBatchName = visibleBatches.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {course.description && <p className="text-sm text-ink">{course.description}</p>}

      {canManage && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">New session</h2>
          <form
            action={createSession.bind(null, courseId, portal)}
            className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 sm:flex-row sm:items-end"
          >
            <BatchField batches={writableBatches} />
            <label className="flex flex-col gap-1 text-sm text-ink">
              Date
              <input type="date" name="date" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
              Topic (optional)
              <input name="topic" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            </label>
            <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
              Create session
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sessions</h2>
        <div className="flex flex-col gap-2">
          {sessions.length === 0 && <p className="text-sm text-muted">No sessions yet.</p>}
          {sessions.map((item) => {
            const heading = (
              <>
                <p className="font-medium text-ink">{formatDisplayDate(item.date)}</p>
                {item.topic && <p className="text-xs text-muted">{item.topic}</p>}
                {showBatchName && <p className="text-xs text-muted">{item.batchName}</p>}
              </>
            );
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card p-4"
              >
                <div>
                  {canManage ? (
                    <Link href={sessionHref(portal, item.id)} className="hover:opacity-80">
                      {heading}
                    </Link>
                  ) : (
                    heading
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{item._count.records} marked</span>
                  {canManage && (
                    <SessionActionsMenu
                      sessionId={item.id}
                      date={item.date.toISOString()}
                      returnTo={courseHref(portal, courseId)}
                      attendanceHref={sessionHref(portal, item.id)}
                      canChangeDate={isFutureSessionDate(item.date)}
                      portal={portal}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
