import { CourseRosterView } from "@/components/course-workspace/roster";

export default async function AdminBatchRosterPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  return <CourseRosterView courseId={courseId} portal="admin" selectedBatchId={batchId} />;
}
