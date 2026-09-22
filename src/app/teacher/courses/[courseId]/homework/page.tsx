import { CourseHomeworkView } from "@/modules/session-homework";

export default async function TeacherHomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { courseId } = await params;
  const { subject } = await searchParams;
  return <CourseHomeworkView courseId={courseId} portal="teacher" selectedSubjectId={subject} />;
}
