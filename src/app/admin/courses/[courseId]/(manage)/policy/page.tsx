import { updateCoursePolicy } from "@/modules/courses/actions";
import { CoursePolicyForm } from "@/modules/courses/ui/course-settings-forms";
import { prisma } from "@/lib/prisma";

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
      <CoursePolicyForm
        action={updateCoursePolicy.bind(null, courseId, "admin")}
        course={course}
        disabled={!course.isActive}
      />
    </section>
  );
}
