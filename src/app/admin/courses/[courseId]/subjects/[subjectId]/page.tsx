import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { toggleSubjectActive, updateSubjectDetails } from "./actions";

export default async function AdminSubjectOverview({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const subject = await prisma.courseSubject.findUnique({
    where: { id: subjectId },
    select: { name: true, isActive: true, courseId: true, course: { select: { isActive: true } } },
  });
  if (!subject || subject.courseId !== courseId) notFound();
  const courseActive = subject.course.isActive;

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
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
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
              <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                {subject.isActive ? "Archive" : "Restore"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
