import { CourseRosterView } from "@/components/course-workspace/roster";

export default async function AdminSubjectRosterPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId, subjectId } = await params;
  return <CourseRosterView courseId={courseId} portal="admin" selectedSubjectId={subjectId} />;
}
