import { redirectToAdminBatchWorkspace } from "@/lib/admin-batch";

export default async function AdminCourseRosterPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await redirectToAdminBatchWorkspace(courseId, "roster");
}
