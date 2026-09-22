import { CourseAttendanceView } from "@/modules/attendance/ui/course-attendance-view";

export default async function CourseAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ subject?: string; category?: string }>;
}) {
  const { courseId } = await params;
  const { subject, category } = await searchParams;
  return (
    <CourseAttendanceView
      courseId={courseId}
      portal="teacher"
      categoryId={category}
      selectedSubjectId={subject}
    />
  );
}
