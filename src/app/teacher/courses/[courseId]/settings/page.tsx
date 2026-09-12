import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { updateCourseDetails } from "./actions";

export default async function CourseSettingsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseConfigure(courseId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true, code: true, description: true },
  });
  if (!course) notFound();

  return (
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
        <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
          Save details
        </button>
      </form>
    </section>
  );
}
