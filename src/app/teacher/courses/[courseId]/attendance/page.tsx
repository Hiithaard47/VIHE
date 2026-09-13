import { CourseAttendanceView } from "@/components/course-workspace/attendance";

export default async function CourseAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ batch?: string; category?: string }>;
}) {
  const { courseId } = await params;
  const { batch, category } = await searchParams;
  return (
    <CourseAttendanceView
      courseId={courseId}
      portal="teacher"
      categoryId={category}
      selectedBatchId={batch}
    />
  );
}
