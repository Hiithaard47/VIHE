import { CourseSessionsView } from "@/components/course-workspace/sessions";

export default async function AdminBatchSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { courseId, batchId } = await params;
  const { category } = await searchParams;
  return <CourseSessionsView courseId={courseId} portal="admin" categoryId={category} selectedBatchId={batchId} />;
}
