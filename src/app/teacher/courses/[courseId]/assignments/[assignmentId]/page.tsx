import { CourseAssignmentDetailView } from "@/components/course-workspace/assignment-detail";

export default async function TeacherAssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { courseId, assignmentId } = await params;
  const { batch } = await searchParams;
  return (
    <CourseAssignmentDetailView
      courseId={courseId}
      assignmentId={assignmentId}
      portal="teacher"
      selectedBatchId={batch}
    />
  );
}
