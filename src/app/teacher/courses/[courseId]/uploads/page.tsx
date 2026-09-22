import { CourseUploadsView } from "@/modules/session-resources/ui/course-uploads-view";

export default async function CourseUploadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { courseId } = await params;
  const { subject } = await searchParams;
  return <CourseUploadsView courseId={courseId} portal="teacher" selectedSubjectId={subject} />;
}
