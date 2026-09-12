import { CourseRosterView } from "@/components/course-workspace/roster";

export default async function CourseRosterPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseRosterView courseId={courseId} portal="teacher" />;
}
