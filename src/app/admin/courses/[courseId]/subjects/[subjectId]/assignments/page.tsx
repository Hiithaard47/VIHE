import { CourseAssignmentsView } from "@/modules/assignments/ui/course-assignments-view";

export default async function AdminSubjectAssignmentsPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  return <CourseAssignmentsView courseId={courseId} portal="admin" selectedSubjectId={subjectId} />;
}
