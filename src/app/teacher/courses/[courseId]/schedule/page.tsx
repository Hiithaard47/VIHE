import { CourseScheduleView } from "@/components/course-workspace/schedule";

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
