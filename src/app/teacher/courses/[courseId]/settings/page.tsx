import { notFound } from "next/navigation";
import { updateCourseDetails, updateCoursePolicy } from "@/app/courses/actions";
import { CourseDetailsForm, CoursePolicyForm } from "@/components/course-settings-forms";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isCourseAdmin } from "@/lib/batch-scope";
import { requireCourseConfigure } from "@/lib/rbac";

export default async function CourseSettingsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseConfigure(courseId);
  const session = await auth();
  const canEditDetails = Boolean(session && isCourseAdmin(session));

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
      {canEditDetails && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
          <CourseDetailsForm action={updateCourseDetails.bind(null, courseId, "teacher")} course={course} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Attendance policy</h2>
        <CoursePolicyForm action={updateCoursePolicy.bind(null, courseId, "teacher")} course={course} />
      </section>
    </div>
  );
}
