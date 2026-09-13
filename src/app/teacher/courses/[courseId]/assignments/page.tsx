import { CourseAssignmentsView } from "@/components/course-workspace/assignments";

export default async function TeacherAssignmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { courseId } = await params;
  const { batch } = await searchParams;
  return <CourseAssignmentsView courseId={courseId} portal="teacher" selectedBatchId={batch} />;
}
