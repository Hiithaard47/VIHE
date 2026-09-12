import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, canManageCourse } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
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
      sessions: { orderBy: { date: "desc" }, include: { _count: { select: { records: true } } } },
    },
  });
  if (!course) notFound();

  const canManage = await canManageCourse(session, courseId);

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
          {course.sessions.length === 0 && <p className="text-sm text-muted">No sessions yet.</p>}
          {course.sessions.map((s) => {
            const row = (
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-card p-4">
                <div>
                  <p className="font-medium text-ink">{new Date(s.date).toLocaleDateString()}</p>
                  {s.topic && <p className="text-xs text-muted">{s.topic}</p>}
                </div>
                <span className="text-xs text-muted">{s._count.records} marked</span>
              </div>
            );
            return canManage ? (
              <Link key={s.id} href={`/teacher/sessions/${s.id}`} className="hover:opacity-80">
                {row}
              </Link>
            ) : (
              <div key={s.id}>{row}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
