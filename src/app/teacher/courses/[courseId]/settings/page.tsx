import { notFound } from "next/navigation";
import { LoginMonthsField } from "@/components/login-months-field";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { STATUS_OPTIONS } from "@/lib/attendance";
import { updateCourseDetails, updateCoursePolicy } from "./actions";

export default async function CourseSettingsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseConfigure(courseId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      name: true,
      code: true,
      description: true,
      loginMonths: true,
      defaultStatus: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      lockAfterDays: true,
    },
  });
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
        <form
          action={updateCourseDetails.bind(null, courseId)}
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
        >
          <label className="flex flex-col gap-1 text-sm text-ink">
            Course name
            <input
              name="name"
              required
              defaultValue={course.name}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Course code
            <input
              name="code"
              required
              defaultValue={course.code}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Description
            <textarea
              name="description"
              rows={3}
              defaultValue={course.description ?? ""}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
          <LoginMonthsField value={course.loginMonths} />
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Save details
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Attendance policy</h2>
        <form
          action={updateCoursePolicy.bind(null, courseId)}
          className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4"
        >
          <label className="flex flex-col gap-1 text-sm text-ink">
            Default status on a fresh session
            <select
              name="defaultStatus"
              defaultValue={course.defaultStatus}
              className="w-fit rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Every unmarked student starts here, so you only tap the exceptions.
            </span>
          </label>

          <fieldset className="flex flex-col gap-2 text-sm text-ink">
            <legend className="text-muted">Counts as attended</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="lateCountsAsAttended" defaultChecked={course.lateCountsAsAttended} />
              Late
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="excusedCountsAsAttended"
                defaultChecked={course.excusedCountsAsAttended}
              />
              Excused
            </label>
            <span className="text-xs text-muted">Present always counts; absent never does.</span>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm text-ink">
            Lock attendance after (days)
            <input
              type="number"
              name="lockAfterDays"
              min={0}
              defaultValue={course.lockAfterDays ?? ""}
              className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
            <span className="text-xs text-muted">Leave blank to never lock.</span>
          </label>

          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Save policy
          </button>
        </form>
      </section>
    </div>
  );
}
