import { CourseSessionsView } from "@/components/course-workspace/sessions";

export default async function AdminCourseSessionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseSessionsView courseId={courseId} portal="admin" />;
}
