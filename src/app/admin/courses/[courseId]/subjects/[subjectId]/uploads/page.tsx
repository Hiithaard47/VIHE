import { CourseUploadsView } from "@/modules/session-resources/ui/course-uploads-view";

export default async function AdminSubjectUploadsPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  return <CourseUploadsView courseId={courseId} portal="admin" selectedSubjectId={subjectId} />;
}
