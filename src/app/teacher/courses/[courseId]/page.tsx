import { CourseSessionsView } from "@/components/course-workspace/sessions";

export default async function CourseSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ category?: string; batch?: string }>;
}) {
  const { courseId } = await params;
  const { category, batch } = await searchParams;
  return <CourseSessionsView courseId={courseId} portal="teacher" categoryId={category} selectedBatchId={batch} />;
}
