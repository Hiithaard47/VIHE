import { CourseSessionsView } from "@/components/course-workspace/sessions";

export default async function CourseSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { courseId } = await params;
  const { category } = await searchParams;
  return <CourseSessionsView courseId={courseId} portal="teacher" categoryId={category} />;
}
