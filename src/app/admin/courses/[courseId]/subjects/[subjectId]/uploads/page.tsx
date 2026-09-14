import { CourseUploadsView } from "@/components/course-workspace/uploads";

export default async function AdminSubjectUploadsPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  return <CourseUploadsView courseId={courseId} portal="admin" selectedSubjectId={subjectId} />;
}
