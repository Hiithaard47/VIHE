import { redirectToAdminBatchWorkspace } from "@/lib/admin-batch";

export default async function AdminCourseAssignmentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await redirectToAdminBatchWorkspace(courseId, "assignments");
}
