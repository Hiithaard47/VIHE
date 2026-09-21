import { CourseHomeworkView } from "@/components/course-workspace/homework";

export default async function AdminSubjectHomeworkPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  return <CourseHomeworkView courseId={courseId} portal="admin" selectedSubjectId={subjectId} />;
}
