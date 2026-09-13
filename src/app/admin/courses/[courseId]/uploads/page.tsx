import { redirectToAdminBatchWorkspace } from "@/lib/admin-batch";

export default async function AdminCourseUploadsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await redirectToAdminBatchWorkspace(courseId, "uploads");
}
