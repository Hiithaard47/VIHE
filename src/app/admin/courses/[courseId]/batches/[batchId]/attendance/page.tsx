import { CourseAttendanceView } from "@/components/course-workspace/attendance";

export default async function AdminBatchAttendancePage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  return <CourseAttendanceView courseId={courseId} portal="admin" selectedBatchId={batchId} />;
}
