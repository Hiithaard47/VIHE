import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, canManageCourse } from "@/lib/rbac";
import { resolveBatchForCourse } from "@/lib/enrollment";
import { PERMISSIONS } from "@/lib/permissions";
import { SessionActionsMenu } from "@/components/session-actions-menu";
import { formatDisplayDate, isFutureSessionDate } from "@/lib/time";
import { createSession } from "./actions";

export default async function CourseSessionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      description: true,
      batches: { where: { isActive: true }, include: { sessions: { orderBy: { date: "desc" }, include: { _count: { select: { records: true } } } } } },
    },
  });
  if (!course) notFound();

  const canManage = await canManageCourse(session, courseId);
  const batchId = await resolveBatchForCourse(courseId, session.user.id, canManage);
  const sessions = course.batches
    .filter((batch) => !batchId || batch.id === batchId)
    .flatMap((batch) => batch.sessions)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="flex flex-col gap-6">
      {course.description && <p className="text-sm text-ink">{course.description}</p>}

      {canManage && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">New session</h2>
          <form
            action={createSession.bind(null, courseId)}
            className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 sm:flex-row sm:items-end"
          >
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
          {sessions.map((s) => {
            const heading = (
              <>
                <p className="font-medium text-ink">{formatDisplayDate(s.date)}</p>
                {s.topic && <p className="text-xs text-muted">{s.topic}</p>}
              </>
            );
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card p-4"
              >
                <div>
                  {canManage ? (
                    <Link href={`/teacher/sessions/${s.id}`} className="hover:opacity-80">
                      {heading}
                    </Link>
                  ) : (
                    heading
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{s._count.records} marked</span>
                  {canManage && (
                    <SessionActionsMenu
                      sessionId={s.id}
                      date={s.date.toISOString()}
                      returnTo={`/teacher/courses/${courseId}`}
                      attendanceHref={`/teacher/sessions/${s.id}`}
                      canChangeDate={isFutureSessionDate(s.date)}
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
