import { CourseAttendanceView } from "@/components/course-workspace/attendance";

export default async function AdminBatchAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { courseId, batchId } = await params;
  const { category } = await searchParams;
  return (
    <CourseAttendanceView
      courseId={courseId}
      portal="admin"
      categoryId={category}
      selectedBatchId={batchId}
    />
  );
}
