import { CourseSessionsView } from "@/components/course-workspace/sessions";

export default async function CourseSessionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseSessionsView courseId={courseId} portal="teacher" />;
}
