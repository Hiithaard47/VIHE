import { CourseAssignmentDetailView } from "@/components/course-workspace/assignment-detail";

export default async function AdminCourseAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = await params;
  return <CourseAssignmentDetailView courseId={courseId} assignmentId={assignmentId} portal="admin" />;
}
