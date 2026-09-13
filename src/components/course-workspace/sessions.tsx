import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageCourse, requireCourseAccess } from "@/lib/rbac";
import { narrowAssignedBatches, resolveTeacherBatchesForCourse } from "@/lib/enrollment";
import { SessionActionsMenu } from "@/components/session-actions-menu";
import { BatchField } from "@/components/course-workspace-fields";
import { sessionHref, sessionListHref, type CoursePortal } from "@/lib/course-workspace";
import {
  DEFAULT_SESSION_CATEGORY_NAME,
  groupSessionsByCategory,
  resolveCategoryTab,
  sessionCategoryTabs,
} from "@/lib/session-categories";
import { formatDisplayDate, isFutureSessionDate } from "@/lib/time";
import { createSession } from "@/app/teacher/courses/[courseId]/actions";

export async function CourseSessionsView({
  courseId,
  portal,
  categoryId,
  selectedBatchId,
}: {
  courseId: string;
  portal: CoursePortal;
  categoryId?: string;
  selectedBatchId?: string;
}) {
  const session = await requireCourseAccess(courseId, portal);

  const [course, categories] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        description: true,
        batches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            sessions: {
              orderBy: [{ date: "asc" }, { startMinute: "asc" }],
              include: { category: { select: { id: true, name: true } }, _count: { select: { records: true } } },
            },
          },
        },
      },
    }),
    prisma.sessionCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!course) notFound();

  const canManage = await canManageCourse(session, courseId);
  const assignedIds = narrowAssignedBatches(
    await resolveTeacherBatchesForCourse(session.user.id, courseId),
    selectedBatchId,
  );
  const visibleBatches = course.batches.filter((batch) => assignedIds.length === 0 || assignedIds.includes(batch.id));
  const sessions = visibleBatches
    .flatMap((batch) => batch.sessions.map((item) => ({ ...item, batchName: batch.name })))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || (a.startMinute ?? 0) - (b.startMinute ?? 0));
  const groups = groupSessionsByCategory(sessions);
  const tabs = sessionCategoryTabs(groups);
  const selected = resolveCategoryTab(tabs, categoryId);
  const writableBatches = visibleBatches.map((batch) => ({ id: batch.id, name: batch.name }));
  const showBatchName = visibleBatches.length > 1;
  const createCategoryId =
    categories.find((category) => category.id === selected?.id)?.id ??
    categories.find((category) => category.name === DEFAULT_SESSION_CATEGORY_NAME)?.id ??
    categories[0]?.id ??
    "";
  const listHref = sessionListHref(portal, courseId, selected?.id, undefined, selectedBatchId);

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
              Name
              <input name="name" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Category
              <select
                name="categoryId"
                required
                defaultValue={createCategoryId}
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
              Create session
            </button>
          </form>
        </section>
      )}

      <section>
        {tabs.length > 0 && (
          <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
            {tabs.map((tab) => {
              const active = tab.id === selected?.id;
              return (
                <Link
                  key={tab.id}
                  href={sessionListHref(portal, courseId, tab.id, undefined, selectedBatchId)}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                    active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {tab.name}
                  {tab.sessions.length > 0 ? ` · ${tab.sessions.length}` : ""}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="mt-3 flex flex-col gap-2">
          {!selected || selected.sessions.length === 0 ? (
            <p className="text-sm text-muted">No sessions yet.</p>
          ) : (
            selected.sessions.map((item) => {
              const heading = (
                <>
                  <p className="font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-muted">
                    {formatDisplayDate(item.date)}
                    {showBatchName ? ` · ${item.batchName}` : ""}
                  </p>
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
                        returnTo={listHref}
                        attendanceHref={sessionHref(portal, item.id)}
                        canChangeDate={isFutureSessionDate(item.date)}
                        canRemove={item._count.records === 0}
                        portal={portal}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
