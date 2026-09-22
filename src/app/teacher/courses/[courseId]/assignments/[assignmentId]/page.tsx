import { CourseAssignmentDetailView } from "@/modules/assignments/ui/course-assignment-detail";

export default async function TeacherAssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { courseId, assignmentId } = await params;
  const { subject } = await searchParams;
  return (
    <CourseAssignmentDetailView
      courseId={courseId}
      assignmentId={assignmentId}
      portal="teacher"
      selectedSubjectId={subject}
    />
  );
}
