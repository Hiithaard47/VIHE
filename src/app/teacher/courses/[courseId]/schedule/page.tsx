import { CourseScheduleView } from "@/modules/schedule/ui/course-schedule-view";

export default async function CourseSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { courseId } = await params;
  const { subject } = await searchParams;
  return <CourseScheduleView courseId={courseId} portal="teacher" selectedSubjectId={subject} />;
}
