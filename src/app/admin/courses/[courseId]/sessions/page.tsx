import { redirectToAdminBatchWorkspace } from "@/lib/admin-batch";

export default async function AdminCourseSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { courseId } = await params;
  const { category } = await searchParams;
  await redirectToAdminBatchWorkspace(courseId, "sessions", { category });
}
