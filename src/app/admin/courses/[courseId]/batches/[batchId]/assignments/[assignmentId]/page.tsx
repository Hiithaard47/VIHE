import { CourseAssignmentDetailView } from "@/components/course-workspace/assignment-detail";

export default async function AdminBatchAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string; assignmentId: string }>;
}) {
  const { courseId, batchId, assignmentId } = await params;
  return (
    <CourseAssignmentDetailView
      courseId={courseId}
      assignmentId={assignmentId}
      portal="admin"
      selectedBatchId={batchId}
    />
  );
}
