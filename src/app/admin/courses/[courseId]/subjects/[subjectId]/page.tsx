import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { deleteSubject, toggleSubjectActive, updateSubjectDetails } from "./actions";

export default async function AdminSubjectOverview({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const [subject, subjectCount, attendanceCount] = await Promise.all([
    prisma.courseSubject.findUnique({
      where: { id: subjectId },
      select: { name: true, isActive: true, courseId: true, course: { select: { isActive: true } } },
    }),
    prisma.courseSubject.count({ where: { courseId } }),
    prisma.attendanceRecord.count({ where: { session: { subjectId } } }),
  ]);
  if (!subject || subject.courseId !== courseId) notFound();
  const courseActive = subject.course.isActive;
  const canDelete = courseActive && subjectCount > 1 && attendanceCount === 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Overview</h2>
        <form
          action={updateSubjectDetails.bind(null, courseId, subjectId)}
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
        >
          <fieldset disabled={!courseActive} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Subject name
            <input name="name" required defaultValue={subject.name} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          {courseActive && (
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              Save details
            </button>
          )}
          </fieldset>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Subject status</h2>
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
          <span>{subject.isActive ? "Active" : "Archived"}</span>
          {courseActive && (
            <form action={toggleSubjectActive.bind(null, courseId, subjectId)}>
              <input type="hidden" name="nextActive" value={(!subject.isActive).toString()} />
              <button
                type="submit"
                className={
                  subject.isActive
                    ? "rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-semibold text-muted"
                    : "rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
                }
              >
                {subject.isActive ? "Archive" : "Restore"}
              </button>
            </form>
          )}
        </div>
      </section>
      {courseActive && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Delete subject</h2>
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
            <p className="text-muted">
              {canDelete
                ? "Permanently removes this subject and its sessions and assignments."
                : subjectCount <= 1
                  ? "A course needs at least one subject."
                  : "This subject has attendance records. Archive it instead of deleting."}
            </p>
            {canDelete && (
              <form action={deleteSubject.bind(null, courseId, subjectId)}>
                <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
                  Delete subject
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
