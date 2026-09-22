import { CourseSessionsView } from "@/modules/sessions/ui/course-sessions-view";

export default async function CourseSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ category?: string; subject?: string }>;
}) {
  const { courseId } = await params;
  const { category, subject } = await searchParams;
  return <CourseSessionsView courseId={courseId} portal="teacher" categoryId={category} selectedSubjectId={subject} />;
}
