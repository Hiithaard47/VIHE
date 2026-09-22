import { CourseAssignmentDetailView } from "@/modules/assignments/ui/course-assignment-detail";

export default async function AdminSubjectAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string; assignmentId: string }>;
}) {
  const { courseId, subjectId, assignmentId } = await params;
  return (
    <CourseAssignmentDetailView
      courseId={courseId}
      assignmentId={assignmentId}
      portal="admin"
      selectedSubjectId={subjectId}
    />
  );
}
