import Link from "next/link";
import { redirect } from "next/navigation";
import { loadCourseWorkspace } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";
import { assignCourseHomework, removeSessionHomework } from "../actions";
import { getCourseHomeworkList } from "../service/queries";
import { courseHref, firstTeacherCoursePath, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { hasCoursesRead, hasWorkspaceWrite } from "@/lib/permissions";

export async function CourseHomeworkView({
  courseId,
  portal,
  selectedSubjectId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedSubjectId?: string;
}) {
  const { session, scope, canManage } = await loadCourseWorkspace(courseId, portal, selectedSubjectId);
  const canWrite = canManage && hasWorkspaceWrite(session.user.permissions);
  if (portal === "teacher" && !hasCoursesRead(session.user.permissions)) {
    redirect(firstTeacherCoursePath(courseId, session.user.permissions));
  }

  const listHref = courseHref(portal, courseId, "homework", selectedSubjectId);
  const { withHomework, withoutHomework, enrollmentCount } = await getCourseHomeworkList(courseId, scope);
  const showSubjectName = new Set(
    [...withHomework, ...withoutHomework].map((item) => item.subject.name),
  ).size > 1;

  return (
    <div className="flex flex-col gap-6">
      {canWrite && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Assign homework</h2>
          {withoutHomework.length === 0 ? (
            <p className="text-sm text-muted">
              Every session already has homework, or create a session first.
            </p>
          ) : (
            <form
              action={assignCourseHomework.bind(null, courseId, portal)}
              className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
            >
              <input type="hidden" name="returnTo" value={listHref} />
              <p className="text-xs text-muted">
                Students upload on the session day only. Homework is not graded.
              </p>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Session
                <select
                  name="sessionId"
                  required
                  className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
                >
                  {withoutHomework.map((item) => (
                    <option key={item.id} value={item.id}>
                      {showSubjectName ? `${item.subject.name} · ` : ""}
                      {item.name} · {formatDisplayDate(item.date)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Title
                <input name="title" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Instructions (optional)
                <textarea
                  name="instructions"
                  rows={3}
                  className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
                />
              </label>
              <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
                Assign homework
              </button>
            </form>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Homework &middot; {withHomework.length}
        </h2>
        <div className="flex flex-col gap-2">
          {withHomework.length === 0 && <p className="text-sm text-muted">No homework assigned yet.</p>}
          {withHomework.map((item) => {
            const homework = item.homework!;
            return (
              <div
                key={homework.id}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <Link
                    href={sessionHref(portal, item.id)}
                    className="font-medium text-ink hover:text-accent-dark"
                  >
                    {homework.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {showSubjectName ? `${item.subject.name} · ` : ""}
                    {item.name} · {formatDisplayDate(item.date)} · {homework._count.submissions}/
                    {enrollmentCount} submitted · not graded
                  </p>
                </div>
                {canWrite && (
                  <form action={removeSessionHomework.bind(null, item.id, portal)}>
                    <input type="hidden" name="returnTo" value={listHref} />
                    <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                      Remove
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
