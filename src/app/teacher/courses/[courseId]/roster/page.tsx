import { CourseRosterView } from "@/components/course-workspace/roster";

export default async function CourseRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { courseId } = await params;
  const { subject } = await searchParams;
  return <CourseRosterView courseId={courseId} portal="teacher" selectedSubjectId={subject} />;
}
