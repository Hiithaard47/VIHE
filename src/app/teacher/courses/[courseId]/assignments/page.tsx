import { CourseAssignmentsView } from "@/components/course-workspace/assignments";

export default async function TeacherAssignmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { courseId } = await params;
  const { subject } = await searchParams;
  return <CourseAssignmentsView courseId={courseId} portal="teacher" selectedSubjectId={subject} />;
}
