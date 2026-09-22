import { CourseSessionsView } from "@/modules/sessions/ui/course-sessions-view";

export default async function AdminSubjectSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { courseId, subjectId } = await params;
  const { category } = await searchParams;
  return <CourseSessionsView courseId={courseId} portal="admin" categoryId={category} selectedSubjectId={subjectId} />;
}
