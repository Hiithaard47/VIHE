import { CourseScheduleView } from "@/components/course-workspace/schedule";

export default async function AdminBatchSchedulePage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  return <CourseScheduleView courseId={courseId} portal="admin" selectedBatchId={batchId} />;
}
