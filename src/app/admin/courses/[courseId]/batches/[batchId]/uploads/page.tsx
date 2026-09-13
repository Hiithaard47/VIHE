import { CourseUploadsView } from "@/components/course-workspace/uploads";

export default async function AdminBatchUploadsPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  return <CourseUploadsView courseId={courseId} portal="admin" selectedBatchId={batchId} />;
}
