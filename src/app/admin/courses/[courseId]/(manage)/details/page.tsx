import { updateCourseDetails } from "@/app/courses/actions";
import { CourseDetailsForm } from "@/components/course-settings-forms";
import { prisma } from "@/lib/prisma";

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
        <CourseDetailsForm
          action={updateCourseDetails.bind(null, courseId, "admin")}
          course={course}
          disabled={!course.isActive}
        />
      </section>
    </div>
  );
}
