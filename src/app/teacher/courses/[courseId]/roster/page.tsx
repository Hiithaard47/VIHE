import { CourseRosterView } from "@/components/course-workspace/roster";

export default async function CourseRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { courseId } = await params;
  const { batch } = await searchParams;
  return <CourseRosterView courseId={courseId} portal="teacher" selectedBatchId={batch} />;
}
