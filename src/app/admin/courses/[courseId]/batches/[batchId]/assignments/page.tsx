import { CourseAssignmentsView } from "@/components/course-workspace/assignments";

export default async function AdminBatchAssignmentsPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  return <CourseAssignmentsView courseId={courseId} portal="admin" selectedBatchId={batchId} />;
}
