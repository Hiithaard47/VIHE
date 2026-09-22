import { CourseRosterView } from "@/modules/roster/ui/course-roster-view";

export default async function AdminCourseRosterPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseRosterView courseId={courseId} portal="admin" />;
}
