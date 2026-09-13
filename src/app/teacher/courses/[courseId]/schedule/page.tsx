import { CourseScheduleView } from "@/components/course-workspace/schedule";

export default async function CourseSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { courseId } = await params;
  const { batch } = await searchParams;
  return <CourseScheduleView courseId={courseId} portal="teacher" selectedBatchId={batch} />;
}
