import { CourseScheduleView } from "@/modules/schedule/ui/course-schedule-view";

export default async function AdminSubjectSchedulePage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  return <CourseScheduleView courseId={courseId} portal="admin" selectedSubjectId={subjectId} />;
}
