import { prisma } from "@/lib/prisma";
import { STATUS_OPTIONS } from "@/lib/attendance";
import { updateCoursePolicy } from "../actions";

export default async function AdminCoursePolicyPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      defaultStatus: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      lockAfterDays: true,
      isActive: true,
    },
  });
  if (!course) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Attendance policy</h2>
      <form action={updateCoursePolicy.bind(null, courseId)} className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4">
        <fieldset disabled={!course.isActive} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Default status on a fresh session
          <select name="defaultStatus" defaultValue={course.defaultStatus} className="w-fit rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink">
            {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        <fieldset className="flex flex-col gap-2 text-sm text-ink">
          <legend className="text-muted">Counts as attended</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="lateCountsAsAttended" defaultChecked={course.lateCountsAsAttended} />Late</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="excusedCountsAsAttended" defaultChecked={course.excusedCountsAsAttended} />Excused</label>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Lock attendance after (days)
          <input type="number" name="lockAfterDays" min={0} defaultValue={course.lockAfterDays ?? ""} className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
        </label>
        {course.isActive && (
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">Save policy</button>
        )}
        </fieldset>
      </form>
    </section>
  );
}
