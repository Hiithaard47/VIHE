import { LoginMonthsField } from "@/components/login-months-field";
import { prisma } from "@/lib/prisma";
import { updateCourseDetails } from "../actions";

export default async function AdminCourseDetailsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true, code: true, description: true, isActive: true, loginMonths: true },
  });
  if (!course) return null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
        <form action={updateCourseDetails.bind(null, courseId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <fieldset disabled={!course.isActive} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Course name
            <input name="name" required defaultValue={course.name} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Course code
            <input name="code" required defaultValue={course.code} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Description
            <textarea name="description" rows={3} defaultValue={course.description ?? ""} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <LoginMonthsField value={course.loginMonths} />
          {course.isActive && (
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">Save details</button>
          )}
          </fieldset>
        </form>
      </section>
    </div>
  );
}
